from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Body, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta, date
import jwt
import bcrypt
import hashlib
import re
import httpx
import stripe
from anthropic import AsyncAnthropic
import json as json_module
import base64
import json
from pywebpush import webpush, WebPushException

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config — no default: the server must not start without a real secret.
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET environment variable is required but not set. "
        "Generate a strong random value (e.g. `openssl rand -hex 32`) and export it before starting the server."
    )
JWT_ALGORITHM = "HS256"

# VAPID Config for Web Push
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_EMAIL = os.environ.get('VAPID_EMAIL', 'mailto:hormoscope@gmail.com')

# ==================== AI (Anthropic, direct SDK — no Emergent proxy) ====================
# The AI coach and daily read call Anthropic directly. When ANTHROPIC_API_KEY
# is unset, AI features degrade gracefully instead of crashing.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")

_anthropic_client = None


def get_anthropic_client() -> AsyncAnthropic:
    """Lazily create the Anthropic client. Raises RuntimeError if no key is set."""
    global _anthropic_client
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    if _anthropic_client is None:
        _anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    return _anthropic_client


async def call_anthropic(system_message: str, messages: list, max_tokens: int = 1024) -> str:
    """Send a message list to Anthropic and return the concatenated text reply."""
    client = get_anthropic_client()
    response = await client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        system=system_message,
        messages=messages,
    )
    return "".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    )

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOnboarding(BaseModel):
    name: str
    birthday: str  # ISO format date YYYY-MM-DD
    cycle_length: int = 28
    last_period_date: str  # ISO format date
    notifications_enabled: bool = True
    notification_time: str = "09:00"

class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    birthday: Optional[str] = None
    age: Optional[int] = None
    cycle_length: int = 28
    period_length: int = 5
    last_period_date: Optional[str] = None
    boyfriend_name: Optional[str] = None
    profile_photo: Optional[str] = None
    is_premium: bool = False
    onboarding_complete: bool = False
    notifications_enabled: bool = True
    notification_time: str = "09:00"
    notification_preferences: Dict[str, bool] = {}
    can_use_boyfriend_mode: bool = False

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class CycleLogCreate(BaseModel):
    date: str
    is_period: bool = False
    flow: Optional[str] = None  # light, medium, heavy
    symptoms: Optional[List[str]] = []
    notes: Optional[str] = None

class IntimacyLogCreate(BaseModel):
    date: str
    notes: Optional[str] = None
    partners: Optional[str] = None

class ChatMessageCreate(BaseModel):
    message: str
    is_boyfriend_mode: bool = False
    conversation_id: Optional[str] = None
    image_base64: Optional[str] = None  # Base64 encoded image for vision

class ChatMessageResponse(BaseModel):
    id: str
    user_message: str
    ai_response: str
    is_boyfriend_mode: bool
    timestamp: str
    conversation_id: Optional[str] = None
    has_image: bool = False

class SubscriptionPackage(BaseModel):
    package_id: str
    origin_url: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    boyfriend_name: Optional[str] = None
    notification_preferences: Optional[Dict[str, bool]] = None
    profile_photo: Optional[str] = None

class PeriodReset(BaseModel):
    new_period_date: str  # ISO format date
    cycle_length: Optional[int] = None
    period_length: Optional[int] = None  # Default to 5 if user hasn't set one

# ==================== HELPERS ====================

def calculate_age(birthday: str) -> int:
    """Calculate age from birthday string"""
    try:
        birth_date = datetime.fromisoformat(birthday.replace('Z', '+00:00'))
        if birth_date.tzinfo is None:
            birth_date = birth_date.replace(tzinfo=timezone.utc)
        today = datetime.now(timezone.utc)
        age = today.year - birth_date.year
        if (today.month, today.day) < (birth_date.month, birth_date.day):
            age -= 1
        return age
    except:
        return 0

def is_birthday_today(birthday: str) -> bool:
    """Check if today is user's birthday"""
    try:
        birth_date = datetime.fromisoformat(birthday.replace('Z', '+00:00'))
        today = datetime.now(timezone.utc)
        return birth_date.month == today.month and birth_date.day == today.day
    except:
        return False

def get_age_group(age: int) -> str:
    """Get age group for personalized content"""
    if age < 18:
        return "teen"
    elif age < 25:
        return "young_adult"
    elif age < 35:
        return "adult"
    elif age < 45:
        return "mature"
    else:
        return "experienced"

async def get_or_create_daily_content(user_id: str, phase: str, cycle_day: int, age_group: str, database, estrogen: int = 50, progesterone: int = 20):
    """Get cached daily content or create new one - AUTOMATICALLY changes at midnight UTC every day"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    print(f"[DAILY CONTENT] User {user_id[:8]}... | Date: {today} | Phase: {phase} | Day: {cycle_day}")
    
    # Check if we have cached content for TODAY only
    cached = await database.daily_content.find_one({
        "user_id": user_id,
        "date": today,  # This is the key - only matches TODAY's date
        "phase": phase
    })
    
    if cached and "mood_prediction" in cached:
        print(f"[DAILY CONTENT] ✓ Cache HIT for {today}")
        return {
            "affirmation": cached["affirmation"],
            "nutrition_tip": cached["nutrition_tip"],
            "foods_to_eat": cached["foods_to_eat"],
            "foods_to_avoid": cached["foods_to_avoid"],
            "wellness_tip": cached["wellness_tip"],
            "mood_prediction": cached["mood_prediction"]
        }
    
    print(f"[DAILY CONTENT] ✗ Cache MISS - generating NEW content for {today}")
    
    # Clean up old cache entries for this user (keep only last 3 days to prevent DB bloat)
    three_days_ago = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%d")
    await database.daily_content.delete_many({
        "user_id": user_id,
        "date": {"$lt": three_days_ago}
    })
    
    # Calculate days since a fixed epoch for guaranteed sequential rotation
    # This ensures NO REPEATS until all items are cycled through
    epoch = datetime(2026, 1, 1, tzinfo=timezone.utc)
    days_since_epoch = (datetime.now(timezone.utc) - epoch).days
    
    # Create user-specific offset so different users get different content on the same day
    user_offset = int(hashlib.sha256(user_id.encode()).hexdigest()[:8], 16)
    
    # Each content type uses a different rotation formula for maximum variety
    affirmation_index = (days_since_epoch + user_offset) 
    nutrition_index = (days_since_epoch + user_offset + cycle_day)
    wellness_index = (days_since_epoch + user_offset * 2)
    mood_index = (days_since_epoch + user_offset + cycle_day * 7)
    
    print(f"[DAILY CONTENT] Day {days_since_epoch} since epoch | Cycle Day {cycle_day}")
    
    affirmations = {
        "menstrual": [
            "I honor my body's natural rhythm and give myself permission to rest.",
            "My period is a sign of health and vitality. I embrace this time of renewal.",
            "I release what no longer serves me and make space for new beginnings.",
            "Rest is productive. I deserve this time to recharge.",
            "My body is wise. I trust its need for gentleness today.",
            "I am allowed to slow down. My worth is not measured by my productivity.",
            "This is my sacred time of renewal and reflection.",
            "I listen to what my body needs and respond with compassion.",
            "Every cycle brings new wisdom. I am learning about myself.",
            "My sensitivity is a superpower, not a weakness.",
            "I embrace the stillness and let my body heal.",
            "Today, I choose rest over rush.",
            "My body is doing important work. I honor this process.",
            "I am worthy of care and tenderness, especially from myself."
        ],
        "follicular": [
            "I am full of creative energy and ready to embrace new beginnings.",
            "My energy is rising and I'm ready to take on new challenges.",
            "I plant seeds of intention that will bloom throughout my cycle.",
            "Fresh starts excite me. I'm open to new possibilities.",
            "My mind is sharp and my body is energized.",
            "I embrace this surge of motivation with gratitude.",
            "Today I start something that my future self will thank me for.",
            "My ideas deserve to be heard and explored.",
            "I am building momentum for beautiful things.",
            "Creativity flows through me effortlessly.",
            "I am magnetic to new opportunities.",
            "My enthusiasm is contagious and inspiring.",
            "I trust my growing strength and confidence.",
            "This is my season of becoming."
        ],
        "ovulatory": [
            "I radiate confidence and attract positive energy into my life.",
            "I am magnetic, powerful, and at my peak potential.",
            "My voice matters. I speak my truth with clarity.",
            "I shine brightly and inspire others around me.",
            "Connection comes naturally to me right now.",
            "I am bold, beautiful, and unapologetically myself.",
            "My words have impact. I choose them with intention.",
            "I attract what I desire with ease and grace.",
            "This is my moment to shine and be seen.",
            "I communicate with confidence and warmth.",
            "My energy draws the right people and opportunities.",
            "I am at the peak of my creative and social power.",
            "Today, I lead with heart and conviction.",
            "I embrace my magnetism and use it for good."
        ],
        "luteal": [
            "I embrace stillness and trust in my body's wisdom.",
            "Slowing down is not weakness, it's wisdom.",
            "I complete what I've started and celebrate my progress.",
            "My need for solitude is valid and necessary.",
            "I nurture myself as I would nurture someone I love.",
            "I give myself permission to say no.",
            "My intuition is guiding me toward what I need.",
            "I am allowed to feel deeply and honor my emotions.",
            "Boundaries protect my energy and peace.",
            "I trust the process of winding down and inward.",
            "Self-care is not selfish, it's essential.",
            "I release the pressure to be constantly productive.",
            "My sensitivity helps me understand myself better.",
            "I am preparing for a beautiful new beginning."
        ]
    }
    
    nutrition_tips = {
        "menstrual": [
            {"tip": "Focus on iron-rich foods to replenish what's lost.", "foods_eat": ["Dark leafy greens", "Lentils", "Red meat", "Pumpkin seeds"], "foods_avoid": ["Excess salt", "Caffeine", "Alcohol", "Processed foods"]},
            {"tip": "Warm, nourishing foods support your body during menstruation.", "foods_eat": ["Bone broth", "Root vegetables", "Ginger tea", "Dark chocolate"], "foods_avoid": ["Cold drinks", "Raw foods", "Sugar", "Dairy"]},
            {"tip": "Anti-inflammatory foods help reduce cramps and discomfort.", "foods_eat": ["Salmon", "Turmeric", "Walnuts", "Olive oil"], "foods_avoid": ["Red meat", "Fried foods", "White bread", "Pasta"]},
            {"tip": "Stay hydrated to help with bloating and fatigue.", "foods_eat": ["Watermelon", "Cucumber", "Herbal teas", "Coconut water"], "foods_avoid": ["Soda", "Energy drinks", "Excess coffee", "Alcohol"]},
            {"tip": "Vitamin C helps with iron absorption during your period.", "foods_eat": ["Oranges", "Bell peppers", "Strawberries", "Broccoli"], "foods_avoid": ["Dairy with iron-rich meals", "Tea with meals", "Calcium supplements", "Antacids"]},
            {"tip": "Omega-3s can help reduce menstrual pain naturally.", "foods_eat": ["Chia seeds", "Flaxseed", "Sardines", "Hemp seeds"], "foods_avoid": ["Trans fats", "Vegetable oils", "Margarine", "Fast food"]},
            {"tip": "Zinc supports hormone balance during menstruation.", "foods_eat": ["Oysters", "Beef", "Chickpeas", "Cashews"], "foods_avoid": ["Phytate-rich foods", "Excess fiber", "Alcohol", "Processed grains"]},
        ],
        "follicular": [
            {"tip": "Light, fresh foods support your rising energy.", "foods_eat": ["Salads", "Citrus fruits", "Sprouts", "Lean proteins"], "foods_avoid": ["Heavy creams", "Fried foods", "Excess carbs", "Alcohol"]},
            {"tip": "Fermented foods support estrogen metabolism.", "foods_eat": ["Kimchi", "Sauerkraut", "Yogurt", "Kombucha"], "foods_avoid": ["Processed foods", "Excess sugar", "Artificial sweeteners", "Fast food"]},
            {"tip": "Protein supports the follicle development happening now.", "foods_eat": ["Eggs", "Chicken breast", "Greek yogurt", "Tofu"], "foods_avoid": ["Processed meats", "Sugary snacks", "White bread", "Soda"]},
            {"tip": "B vitamins boost the energy surge you're feeling.", "foods_eat": ["Whole grains", "Avocado", "Legumes", "Sunflower seeds"], "foods_avoid": ["Refined grains", "Alcohol", "Excess caffeine", "Sugar"]},
            {"tip": "Phytoestrogens support healthy estrogen levels.", "foods_eat": ["Flaxseeds", "Sesame seeds", "Soy products", "Berries"], "foods_avoid": ["Excess dairy", "Red meat", "Processed soy", "Alcohol"]},
            {"tip": "Vitamin E supports egg health during this phase.", "foods_eat": ["Almonds", "Spinach", "Sweet potato", "Sunflower seeds"], "foods_avoid": ["Fried foods", "Processed snacks", "Margarine", "Shortening"]},
            {"tip": "Fresh vegetables support your body's natural detox.", "foods_eat": ["Artichokes", "Asparagus", "Beets", "Carrots"], "foods_avoid": ["Canned vegetables", "Frozen dinners", "Preservatives", "MSG"]},
        ],
        "ovulatory": [
            {"tip": "Raw vegetables and fiber support peak metabolism.", "foods_eat": ["Raw veggies", "Berries", "Quinoa", "Light fish"], "foods_avoid": ["Heavy meals", "Excess dairy", "Alcohol", "Processed foods"]},
            {"tip": "Antioxidant-rich foods support this fertile phase.", "foods_eat": ["Blueberries", "Pomegranate", "Green tea", "Spinach"], "foods_avoid": ["Trans fats", "Excess caffeine", "Artificial additives", "Fried foods"]},
            {"tip": "Glutathione-rich foods support egg quality.", "foods_eat": ["Asparagus", "Avocado", "Spinach", "Garlic"], "foods_avoid": ["Alcohol", "Acetaminophen", "Processed foods", "Excess sugar"]},
            {"tip": "Light proteins keep energy high without weighing you down.", "foods_eat": ["Shrimp", "White fish", "Egg whites", "Tempeh"], "foods_avoid": ["Heavy red meat", "Creamy sauces", "Fried foods", "Fast food"]},
            {"tip": "Zinc is crucial for ovulation and fertility.", "foods_eat": ["Pumpkin seeds", "Lamb", "Chickpeas", "Cocoa"], "foods_avoid": ["Phytates", "Excess calcium", "Alcohol", "Coffee"]},
            {"tip": "Stay cool with hydrating foods during peak fertility.", "foods_eat": ["Watermelon", "Cucumber", "Celery", "Coconut water"], "foods_avoid": ["Spicy foods", "Excess sodium", "Alcohol", "Caffeine"]},
            {"tip": "Folate supports cellular health during ovulation.", "foods_eat": ["Lentils", "Leafy greens", "Citrus", "Fortified cereals"], "foods_avoid": ["Alcohol", "Excess vitamin A", "Processed foods", "Deli meats"]},
        ],
        "luteal": [
            {"tip": "Complex carbs help stabilize mood and reduce PMS.", "foods_eat": ["Sweet potatoes", "Brown rice", "Oats", "Whole grains"], "foods_avoid": ["Simple sugars", "Caffeine", "Alcohol", "Salty snacks"]},
            {"tip": "Magnesium helps with water retention and mood swings.", "foods_eat": ["Dark chocolate", "Almonds", "Avocado", "Banana"], "foods_avoid": ["Caffeine", "Alcohol", "High sodium foods", "Sugar"]},
            {"tip": "Calcium can reduce PMS symptoms by up to 50%.", "foods_eat": ["Yogurt", "Kale", "Sardines", "Fortified milk"], "foods_avoid": ["Excess phosphorus", "Soda", "Too much protein", "Oxalate-rich foods"]},
            {"tip": "Vitamin B6 helps with mood and reduces bloating.", "foods_eat": ["Chicken", "Potatoes", "Bananas", "Pistachios"], "foods_avoid": ["Alcohol", "Refined carbs", "Excess salt", "Caffeine"]},
            {"tip": "Fiber helps your body process excess hormones.", "foods_eat": ["Chia seeds", "Broccoli", "Apples", "Lentils"], "foods_avoid": ["Low-fiber processed foods", "White bread", "Pastries", "Candy"]},
            {"tip": "Healthy fats support progesterone production.", "foods_eat": ["Salmon", "Olive oil", "Walnuts", "Egg yolks"], "foods_avoid": ["Trans fats", "Fried foods", "Margarine", "Processed snacks"]},
            {"tip": "Tryptophan-rich foods boost serotonin for better mood.", "foods_eat": ["Turkey", "Pumpkin seeds", "Cheese", "Oats"], "foods_avoid": ["Artificial sweeteners", "Excess sugar", "Alcohol", "Caffeine"]},
        ]
    }
    
    wellness_tips = {
        "menstrual": [
            "Gentle yoga and warm baths can help ease cramps.",
            "Try a heating pad for natural pain relief.",
            "Journaling can unlock deep insights during your period.",
            "Prioritize sleep - your body is doing renewal work.",
            "Light walking can actually help reduce cramp intensity.",
            "Magnesium oil massage can ease muscle tension.",
            "This is the perfect time for a digital detox.",
            "Drink warm ginger tea for natural cramp relief.",
            "Watch your favorite comfort movie without guilt.",
            "Try restorative yoga poses like child's pose and legs up the wall.",
            "A weighted blanket can feel extra comforting now.",
            "Let yourself nap if your body asks for it.",
            "Pamper your skin - it may be more sensitive now.",
            "Listen to calming music or nature sounds."
        ],
        "follicular": [
            "Great time to start new health habits!",
            "Try a new workout class - your body is ready.",
            "Social activities feel easier now.",
            "Start that project you've been putting off.",
            "Your brain is primed for learning new skills.",
            "Schedule important meetings and presentations.",
            "Try high-intensity interval training (HIIT).",
            "Explore a new neighborhood or hiking trail.",
            "Your focus is enhanced - tackle complex tasks.",
            "Start a new book or online course.",
            "Plan your calendar for the coming weeks.",
            "Try a new healthy recipe.",
            "Clean and organize your living space.",
            "Make plans with friends you've been missing."
        ],
        "ovulatory": [
            "Social activities flow best during this phase.",
            "Important conversations are enhanced now.",
            "High-intensity workouts feel amazing.",
            "Your communication skills peak now.",
            "Great time for job interviews or negotiations.",
            "Your pain tolerance is highest - try that tough workout!",
            "Connect with friends - you're extra magnetic.",
            "Schedule that important meeting or pitch.",
            "Try a spin class or dance workout.",
            "Host a gathering or plan a date night.",
            "Your verbal fluency is at its peak - write or present.",
            "Take photos - you're likely feeling your most confident.",
            "Express something you've been holding back.",
            "Network and make new professional connections."
        ],
        "luteal": [
            "Journaling and meditation help process emotions.",
            "Organize and declutter - nesting instincts are high.",
            "Gentle stretching supports your changing energy.",
            "Practice saying no - boundaries are important.",
            "Pilates and yoga are perfect for this phase.",
            "Batch cooking can help when energy dips.",
            "Extra sleep is not lazy - it's necessary.",
            "Take long, peaceful walks in nature.",
            "Prepare comforting meals in advance.",
            "Create a cozy evening routine.",
            "Write down what you're grateful for.",
            "Reduce screen time before bed.",
            "Take a relaxing bath with Epsom salts.",
            "Give yourself permission to cancel plans if needed."
        ]
    }
    
    phase_affirmations = affirmations.get(phase, affirmations["menstrual"])
    phase_nutrition = nutrition_tips.get(phase, nutrition_tips["menstrual"])
    phase_wellness = wellness_tips.get(phase, wellness_tips["menstrual"])
    
    # Generate mood prediction for caching - use mood_index for variety
    mood_prediction = get_mood_prediction(phase, cycle_day, estrogen, progesterone, user_id, mood_index)
    
    # Use sequential rotation indices - GUARANTEES different content each day
    content = {
        "user_id": user_id,
        "date": today,
        "affirmation": phase_affirmations[affirmation_index % len(phase_affirmations)],
        "nutrition_tip": phase_nutrition[nutrition_index % len(phase_nutrition)]["tip"],
        "foods_to_eat": phase_nutrition[nutrition_index % len(phase_nutrition)]["foods_eat"],
        "foods_to_avoid": phase_nutrition[nutrition_index % len(phase_nutrition)]["foods_avoid"],
        "wellness_tip": phase_wellness[wellness_index % len(phase_wellness)]
    }
    
    # Build content to save
    content_to_save = {
        "user_id": user_id,
        "date": today,
        "phase": phase,  # Store phase to detect phase changes
        "affirmation": content["affirmation"],
        "nutrition_tip": content["nutrition_tip"],
        "foods_to_eat": content["foods_to_eat"],
        "foods_to_avoid": content["foods_to_avoid"],
        "wellness_tip": content["wellness_tip"],
        "mood_prediction": mood_prediction  # Cache mood prediction too
    }
    
    # Save to database so it stays the same all day
    try:
        # Delete any old cache for today (in case phase changed)
        await database.daily_content.delete_many({"user_id": user_id, "date": today})
        result = await database.daily_content.insert_one(content_to_save)
        print(f"[DAILY CONTENT] Saved new content to cache")
    except Exception as e:
        print(f"[CACHE ERROR] Failed to save: {e}")
    
    return {
        "affirmation": content["affirmation"],
        "nutrition_tip": content["nutrition_tip"],
        "foods_to_eat": content["foods_to_eat"],
        "foods_to_avoid": content["foods_to_avoid"],
        "wellness_tip": content["wellness_tip"],
        "mood_prediction": mood_prediction
    }

def get_daily_seed(user_id: str, cycle_day: int) -> int:
    """Generate daily seed for rotating content based on date and user ONLY"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Only use user_id and date - NOT cycle_day to prevent changes within same day
    seed_string = f"{user_id}-{today}"
    return int(hashlib.sha256(seed_string.encode()).hexdigest()[:8], 16)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def build_user_response(user: dict) -> UserResponse:
    """Build UserResponse with calculated fields"""
    age = calculate_age(user.get("birthday", "")) if user.get("birthday") else None
    can_use_bf = age is not None and age >= 18
    
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
        birthday=user.get("birthday"),
        age=age,
        cycle_length=user.get("cycle_length", 28),
        period_length=user.get("period_length", 5),
        last_period_date=user.get("last_period_date"),
        boyfriend_name=user.get("boyfriend_name"),
        profile_photo=user.get("profile_photo"),
        is_premium=user.get("is_premium", False),
        onboarding_complete=user.get("onboarding_complete", False),
        notifications_enabled=user.get("notifications_enabled", True),
        notification_time=user.get("notification_time", "09:00"),
        notification_preferences=user.get("notification_preferences", {}),
        can_use_boyfriend_mode=can_use_bf
    )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_cycle_info(last_period_date: str, cycle_length: int):
    """Calculate current cycle day and phase with hormone levels.
    Safely handles stale or malformed dates by clamping huge gaps to a single
    cycle (modulo) so we never report 'period is 520,569 days late'."""
    try:
        last_period = datetime.fromisoformat(last_period_date.replace('Z', '+00:00'))
        if last_period.tzinfo is None:
            last_period = last_period.replace(tzinfo=timezone.utc)
        today = datetime.now(timezone.utc)
        days_since_raw = (today - last_period).days

        # SAFETY: if the stored date is way in the past (> 2 cycle lengths), the user
        # almost certainly hasn't reset their period date. Project forward by full
        # cycles so we still show a sensible cycle_day instead of "5234 days late".
        MAX_LATE_DAYS = cycle_length + 14  # at most 2 weeks late before we re-project
        if days_since_raw > MAX_LATE_DAYS:
            # Walk last_period forward by cycle_length until it's within MAX_LATE_DAYS of today
            projected = last_period
            while (today - projected).days > MAX_LATE_DAYS:
                projected = projected + timedelta(days=cycle_length)
            days_since = (today - projected).days
        else:
            days_since = days_since_raw

        # SAFETY: negative days_since means the date is in the future — clamp to day 1
        if days_since < 0:
            days_since = 0

        # Period is "late" only when we've passed the expected start of the next cycle.
        # On day N where N == cycle_length, today IS the expected day → "expected today".
        # On day N+1, period is 1 day late, etc.
        period_is_late = days_since >= cycle_length
        days_late = max(0, days_since - cycle_length)

        cycle_day = days_since + 1
        
        # Calculate hormone levels based on cycle day (capped at cycle_length for hormone calc)
        def get_hormone_levels(day, total_days):
            # Cap day at cycle length for hormone calculations
            effective_day = min(day, total_days)
            # Estrogen peaks around day 12-14
            estrogen_peak = total_days * 0.45
            estrogen = max(10, min(95, 100 - abs(effective_day - estrogen_peak) * 5))
            
            # Progesterone rises after ovulation (day 14+)
            if effective_day < total_days * 0.5:
                progesterone = max(10, 25 - effective_day)
            else:
                progesterone = min(90, 20 + (effective_day - total_days * 0.5) * 6)
            
            return round(estrogen), round(progesterone)
        
        estrogen, progesterone = get_hormone_levels(cycle_day, cycle_length)
        
        # Determine phase - if period is late, show "waiting" state
        if period_is_late:
            phase = "late"
            phase_info = "Period Expected"
            if days_late == 0:
                phase_description = "Your period is expected today. Every body is different — it may arrive soon."
            else:
                phase_description = f"Your period was expected {days_late} day{'s' if days_late != 1 else ''} ago. Every body is different — it may arrive soon."
            energy_level = 45
            pain_threshold = 40
        elif cycle_day <= 5:
            phase = "menstrual"
            phase_info = "Menstrual Phase"
            phase_description = "Your body is shedding the uterine lining. Rest and self-care are essential."
            energy_level = 35
            pain_threshold = 30
        elif cycle_day <= 12:
            phase = "follicular"
            phase_info = "Follicular Phase"
            phase_description = "Estrogen rises, energy increases. Great time for new projects and socializing."
            energy_level = 75
            pain_threshold = 70
        elif cycle_day <= 19:
            phase = "ovulatory"
            phase_info = "Ovulatory Phase"
            phase_description = "Peak energy and confidence. Your most fertile window."
            energy_level = 90
            pain_threshold = 85
        else:
            phase = "luteal"
            phase_info = "Luteal Phase"
            phase_description = "Progesterone rises. Focus on completion tasks and self-reflection."
            energy_level = 55
            pain_threshold = 50
        
        # Calculate next period date
        if period_is_late:
            # Period is late - next period date is "any day now"
            days_until_next = 0
            next_period_date = today
        else:
            days_until_next = cycle_length - days_since
            next_period_date = today + timedelta(days=days_until_next)
        
        return {
            "cycle_day": cycle_day,
            "cycle_length": cycle_length,
            "phase": phase,
            "phase_info": phase_info,
            "phase_description": phase_description,
            "days_until_period": days_until_next,
            "next_period_date": next_period_date.strftime("%Y-%m-%d"),
            "estrogen_level": estrogen,
            "progesterone_level": progesterone,
            "energy_level": energy_level,
            "pain_threshold": pain_threshold,
            "period_is_late": period_is_late,
            "days_late": days_late
        }
    except:
        return {
            "cycle_day": 1,
            "cycle_length": 28,
            "phase": "menstrual",
            "phase_info": "Menstrual Phase",
            "phase_description": "Track your cycle to get personalized insights.",
            "days_until_period": 28,
            "next_period_date": None,
            "estrogen_level": 50,
            "progesterone_level": 20,
            "energy_level": 50,
            "pain_threshold": 50,
            "period_is_late": False,
            "days_late": 0
        }

def get_daily_content(phase: str, cycle_day: int, user_id: str, age_group: str) -> dict:
    """Get daily rotating content based on phase, day, and user"""
    seed = get_daily_seed(user_id, cycle_day)
    
    # Multiple options for each phase - rotates daily
    affirmations = {
        "menstrual": [
            "I honor my body's natural rhythm and give myself permission to rest.",
            "My period is a sign of health and vitality. I embrace this time of renewal.",
            "I release what no longer serves me and make space for new beginnings.",
            "Rest is productive. I deserve this time to recharge.",
            "My body is wise. I trust its need for gentleness today.",
            "I am not broken. I am cycling through nature's design.",
            "This phase is my superpower for intuition and reflection."
        ],
        "follicular": [
            "I am full of creative energy and ready to embrace new beginnings.",
            "My energy is rising and I'm ready to take on new challenges.",
            "I plant seeds of intention that will bloom throughout my cycle.",
            "Fresh starts excite me. I'm open to new possibilities.",
            "My mind is sharp and my body is energized.",
            "I embrace change and welcome growth.",
            "This is my time to dream big and plan boldly."
        ],
        "ovulatory": [
            "I radiate confidence and attract positive energy into my life.",
            "I am magnetic, powerful, and at my peak potential.",
            "My voice matters. I speak my truth with clarity.",
            "I shine brightly and inspire others around me.",
            "Connection comes naturally to me right now.",
            "I am fertile with creativity, ideas, and possibility.",
            "This is my time to lead, connect, and create."
        ],
        "luteal": [
            "I embrace stillness and trust in my body's wisdom.",
            "Slowing down is not weakness, it's wisdom.",
            "I complete what I've started and celebrate my progress.",
            "My need for solitude is valid and necessary.",
            "I nurture myself as I would nurture someone I love.",
            "My emotions are messengers. I listen with compassion.",
            "I prepare for renewal with patience and self-love."
        ]
    }
    
    nutrition_tips = {
        "menstrual": [
            {"tip": "Focus on iron-rich foods like spinach, lentils, and red meat to replenish what's lost.", "foods_eat": ["Dark leafy greens", "Lentils", "Grass-fed beef", "Pumpkin seeds"], "foods_avoid": ["Excess salt", "Caffeine", "Alcohol", "Processed foods"]},
            {"tip": "Warm, nourishing soups and stews support your body during menstruation.", "foods_eat": ["Bone broth", "Root vegetables", "Ginger tea", "Dark chocolate"], "foods_avoid": ["Cold drinks", "Raw foods", "Sugar", "Dairy"]},
            {"tip": "Anti-inflammatory foods can help reduce cramps and discomfort.", "foods_eat": ["Turmeric", "Salmon", "Walnuts", "Berries"], "foods_avoid": ["Fried foods", "Red meat excess", "Soda", "White bread"]},
            {"tip": "Magnesium-rich foods help relax muscles and ease period pain.", "foods_eat": ["Bananas", "Avocados", "Almonds", "Black beans"], "foods_avoid": ["Caffeine", "Alcohol", "Excess sugar", "Salty snacks"]},
        ],
        "follicular": [
            {"tip": "Light, fresh foods support your rising energy during this phase.", "foods_eat": ["Salads", "Citrus fruits", "Sprouts", "Lean proteins"], "foods_avoid": ["Heavy creams", "Fried foods", "Excess carbs", "Alcohol"]},
            {"tip": "Fermented foods support estrogen metabolism as levels rise.", "foods_eat": ["Kimchi", "Sauerkraut", "Yogurt", "Kombucha"], "foods_avoid": ["Processed foods", "Excess sugar", "Artificial sweeteners", "Fast food"]},
            {"tip": "Protein-rich foods fuel your increasing energy and activity.", "foods_eat": ["Eggs", "Chicken", "Quinoa", "Greek yogurt"], "foods_avoid": ["Heavy meals", "Excess fats", "Sugary drinks", "Processed snacks"]},
            {"tip": "Zinc-rich foods support follicle development and hormone balance.", "foods_eat": ["Oysters", "Pumpkin seeds", "Chickpeas", "Cashews"], "foods_avoid": ["Phytates", "Excess fiber", "Processed grains", "Soy products"]},
        ],
        "ovulatory": [
            {"tip": "Raw vegetables and fiber support your body's peak metabolism.", "foods_eat": ["Raw veggies", "Berries", "Quinoa", "Light fish"], "foods_avoid": ["Heavy meals", "Excess dairy", "Alcohol", "Processed foods"]},
            {"tip": "Antioxidant-rich foods support egg quality during ovulation.", "foods_eat": ["Blueberries", "Pomegranate", "Green tea", "Spinach"], "foods_avoid": ["Trans fats", "Excess caffeine", "Artificial additives", "Fried foods"]},
            {"tip": "Stay hydrated - your body temperature rises during ovulation.", "foods_eat": ["Watermelon", "Cucumber", "Coconut water", "Herbal teas"], "foods_avoid": ["Dehydrating foods", "Excess sodium", "Alcohol", "Coffee excess"]},
            {"tip": "Light, cooling foods match your peak energy and body heat.", "foods_eat": ["Smoothies", "Gazpacho", "Sushi", "Fresh fruits"], "foods_avoid": ["Spicy foods", "Heavy proteins", "Greasy meals", "Hot soups"]},
        ],
        "luteal": [
            {"tip": "Complex carbs help stabilize mood and reduce PMS symptoms.", "foods_eat": ["Sweet potatoes", "Brown rice", "Oats", "Whole grains"], "foods_avoid": ["Simple sugars", "Caffeine", "Alcohol", "Salty snacks"]},
            {"tip": "B-vitamin rich foods support progesterone and reduce PMS.", "foods_eat": ["Chickpeas", "Turkey", "Sunflower seeds", "Spinach"], "foods_avoid": ["Refined carbs", "Excess salt", "Artificial sweeteners", "Processed meats"]},
            {"tip": "Magnesium helps with water retention and mood swings.", "foods_eat": ["Dark chocolate", "Almonds", "Avocado", "Banana"], "foods_avoid": ["Caffeine", "Alcohol", "High sodium foods", "Sugar"]},
            {"tip": "Calcium-rich foods can reduce PMS symptoms by up to 50%.", "foods_eat": ["Kale", "Sardines", "Fortified plant milk", "Sesame seeds"], "foods_avoid": ["Excess protein", "Soda", "Excess fiber", "Oxalate-rich foods"]},
        ]
    }
    
    wellness_tips = {
        "menstrual": [
            "Gentle yoga and warm baths can help ease cramps and discomfort.",
            "Try a heating pad on your lower back or abdomen for natural pain relief.",
            "Journaling during your period can unlock deep insights and emotional release.",
            "Prioritize sleep - your body is doing important renewal work.",
            "Light walks in nature can boost mood without depleting energy."
        ],
        "follicular": [
            "Great time to start new health habits - your motivation is at its peak!",
            "Try a new workout class or physical challenge - your body is ready.",
            "Brain games and learning new skills are enhanced during this phase.",
            "Social activities feel easier now - schedule that coffee date!",
            "Start that project you've been putting off - your focus is sharp."
        ],
        "ovulatory": [
            "Social activities and important conversations flow best during this phase.",
            "Public speaking, presentations, and negotiations are enhanced now.",
            "High-intensity workouts feel amazing - push yourself if it feels good.",
            "Your communication skills peak now - have those important talks.",
            "Creativity and problem-solving are at their best - brainstorm freely."
        ],
        "luteal": [
            "Journaling and meditation can help process emotions during this reflective time.",
            "Organize and declutter - nesting instincts are high in this phase.",
            "Gentle stretching and restorative yoga support your changing energy.",
            "Complete projects rather than starting new ones - closure feels good.",
            "Practice saying no - boundaries are easier to honor when you're rested."
        ]
    }
    
    phase_affirmations = affirmations.get(phase, affirmations["menstrual"])
    phase_nutrition = nutrition_tips.get(phase, nutrition_tips["menstrual"])
    phase_wellness = wellness_tips.get(phase, wellness_tips["menstrual"])
    
    # Use seed to select daily content
    affirmation_idx = seed % len(phase_affirmations)
    nutrition_idx = seed % len(phase_nutrition)
    wellness_idx = seed % len(phase_wellness)
    
    nutrition = phase_nutrition[nutrition_idx]
    
    return {
        "affirmation": phase_affirmations[affirmation_idx],
        "nutrition_tip": nutrition["tip"],
        "foods_to_eat": nutrition["foods_eat"],
        "foods_to_avoid": nutrition["foods_avoid"],
        "wellness_tip": phase_wellness[wellness_idx]
    }

def get_mood_prediction(phase: str, cycle_day: int, estrogen: int, progesterone: int, user_id: str = "", external_seed: int = None) -> dict:
    """Get detailed mood prediction with relationship advice based on hormone levels - activities rotate daily"""
    
    # Use external seed if provided, otherwise generate one
    if external_seed is not None:
        seed = external_seed
    else:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        seed = int(hashlib.sha256(f"{user_id}-{today}-mood".encode()).hexdigest()[:8], 16)
    
    # Extended activities pool for daily rotation
    all_best_activities = {
        "menstrual": [
            "Journaling", "Warm baths", "Watching comfort shows", "Light stretching",
            "Reading a good book", "Meditation", "Gentle yoga", "Calling a close friend",
            "Taking a long nap", "Listening to calming music", "Writing letters to yourself",
            "Organizing your space slowly", "Making comfort food", "Watching the sunset"
        ],
        "follicular": [
            "Date nights", "Trying new things together", "Making future plans", "Social gatherings",
            "Starting a new project", "Hitting the gym", "Networking events", "Learning something new",
            "Planning a trip", "Trying a new restaurant", "Creative hobbies", "Morning runs",
            "Brainstorming sessions", "Meeting new people"
        ],
        "ovulatory": [
            "Important conversations", "Meeting new people", "Presentations", "Intimacy",
            "Public speaking", "Asking for a raise", "First dates", "Parties and events",
            "Photoshoots", "Job interviews", "Leading meetings", "Negotiating deals",
            "Making bold moves", "Expressing your feelings"
        ],
        "luteal": [
            "Self-care routines", "Comfort activities", "Light organization", "Early bedtimes",
            "Meal prepping", "Decluttering", "Finishing projects", "Cozy movie nights",
            "Baking or cooking", "Taking long walks", "Gratitude journaling", "Gentle stretching",
            "Planning next month", "Digital detox"
        ]
    }
    
    all_avoid_activities = {
        "menstrual": [
            "Confrontational conversations", "Making big decisions", "High-intensity socializing",
            "Starting new projects", "Intense workouts", "Overcommitting", "Skipping meals",
            "Staying up late", "Drinking too much caffeine", "Ignoring your needs"
        ],
        "follicular": [
            "Isolating yourself", "Overthinking past arguments", "Staying in your comfort zone",
            "Procrastinating", "Negative self-talk", "Skipping workouts", "Being too cautious"
        ],
        "ovulatory": [
            "Staying home alone", "Avoiding social contact", "Playing small",
            "Hiding your ideas", "Being overly modest", "Missing opportunities", "Overworking alone"
        ],
        "luteal": [
            "Starting arguments", "Making accusations", "Bringing up past issues", "Big decisions",
            "Impulsive purchases", "Overanalyzing texts", "Comparing yourself to others",
            "Skipping sleep", "Too much sugar", "Ignoring emotions"
        ]
    }
    
    # Mood predictions - multiple per phase for daily rotation
    mood_data = {
        "menstrual": [
            {
                "mood": "Reflective & Introspective",
                "emotional_state": "You may feel more tired and withdrawn. This is normal - your body is working hard.",
                "relationship_advice": "NOT a good day for serious relationship talks. Your patience is lower and you may overreact. Save important conversations for Day 6-7 when estrogen rises.",
                "communication_warning": "High irritability risk today. If your partner says something that bothers you, wait 24 hours before responding.",
                "partner_tip": "Let your partner know you need extra gentleness today. It's okay to ask for space."
            },
            {
                "mood": "Restorative & Quiet",
                "emotional_state": "Your body is in renewal mode. Honor the need for rest and solitude.",
                "relationship_advice": "Keep conversations light today. Deep discussions can wait until your energy returns.",
                "communication_warning": "You may feel more sensitive to criticism. Remember it's hormonal, not personal.",
                "partner_tip": "A simple 'I need quiet time' can prevent misunderstandings."
            },
            {
                "mood": "Inward & Peaceful",
                "emotional_state": "This is your body's natural reset. Embrace the slower pace.",
                "relationship_advice": "Focus on self-connection today. Relationship talks can happen when you feel stronger.",
                "communication_warning": "Words may come out harsher than intended. Pause before responding.",
                "partner_tip": "Physical comfort like a warm hug can speak louder than words right now."
            },
            {
                "mood": "Contemplative & Gentle",
                "emotional_state": "Your intuition is heightened. Pay attention to your inner wisdom.",
                "relationship_advice": "Journal your feelings instead of venting them. Process first, communicate later.",
                "communication_warning": "Avoid making permanent decisions based on temporary feelings.",
                "partner_tip": "Ask for what you need directly - your partner can't read your mind."
            },
            {
                "mood": "Tender & Releasing",
                "emotional_state": "Emotions may surface easily. Let them flow without judgment.",
                "relationship_advice": "It's okay to say 'I'm not in the headspace for this conversation right now.'",
                "communication_warning": "Old hurts may resurface. Recognize them as hormonal amplification.",
                "partner_tip": "Comfort food, cozy blankets, and patience are your love languages today."
            }
        ],
        "follicular": [
            {
                "mood": "Optimistic & Energized",
                "emotional_state": "Rising estrogen is boosting your mood! You'll feel more positive, creative, and open to new experiences.",
                "relationship_advice": "GREAT time for relationship talks! Your communication skills are improving. Days 6-12 are your window for important conversations.",
                "communication_warning": "You're more receptive and patient now. Use this energy to address any lingering issues with your partner.",
                "partner_tip": "Your confidence and charm are high - plan something special with your partner!"
            },
            {
                "mood": "Fresh & Motivated",
                "emotional_state": "Your brain is primed for new beginnings. Ideas flow easily and enthusiasm is natural.",
                "relationship_advice": "Great day to plan future adventures together. Your optimism is contagious!",
                "communication_warning": "You may be more agreeable than usual - make sure you're not just people-pleasing.",
                "partner_tip": "Share your new ideas and dreams. Your excitement will inspire connection."
            },
            {
                "mood": "Curious & Open",
                "emotional_state": "Your mind is expansive and ready to learn. Novelty feels exciting, not scary.",
                "relationship_advice": "Ask deeper questions. You're genuinely interested in understanding others now.",
                "communication_warning": "Your patience is higher - use it to listen more than you speak.",
                "partner_tip": "Try something new together. Your adventurous spirit is showing!"
            },
            {
                "mood": "Playful & Light",
                "emotional_state": "A sense of possibility fills the air. Everything feels a little more fun.",
                "relationship_advice": "Bring humor into your conversations. Lightness resolves tension better than seriousness.",
                "communication_warning": "Don't dismiss your needs just because you feel good. Balance matters.",
                "partner_tip": "Flirt a little! Your playful energy is attractive and refreshing."
            },
            {
                "mood": "Creative & Inspired",
                "emotional_state": "Your creative juices are flowing. Express yourself freely.",
                "relationship_advice": "Write that love note or plan that surprise. Your romantic creativity peaks now.",
                "communication_warning": "Channel creative energy productively - restlessness can become impatience.",
                "partner_tip": "Share your creative projects. Vulnerability through art deepens intimacy."
            }
        ],
        "ovulatory": [
            {
                "mood": "Confident & Magnetic",
                "emotional_state": "Peak estrogen! You're at your most confident, attractive, and communicative. You'll feel unstoppable.",
                "relationship_advice": "BEST days for important talks! Your ability to articulate feelings and understand your partner is at maximum. Schedule that talk you've been avoiding.",
                "communication_warning": "You may feel more flirtatious and social than usual. Channel this energy positively in your relationship.",
                "partner_tip": "Your partner will find you extra attractive right now. Make the most of this connection time!"
            },
            {
                "mood": "Radiant & Powerful",
                "emotional_state": "You're glowing from the inside out. Your presence commands attention naturally.",
                "relationship_advice": "Speak your truth boldly. Your words carry extra weight and clarity now.",
                "communication_warning": "High confidence can sometimes overshadow others. Make space for their voice too.",
                "partner_tip": "Initiate intimacy if you feel it. Your desire and attractiveness are aligned."
            },
            {
                "mood": "Social & Charming",
                "emotional_state": "Connection feels effortless. You draw people to you like a magnet.",
                "relationship_advice": "Introduce your partner to friends or double date. Your social grace shines.",
                "communication_warning": "Enjoy the attention but stay grounded in your commitments.",
                "partner_tip": "Public displays of affection feel natural. Show them off a little!"
            },
            {
                "mood": "Bold & Expressive",
                "emotional_state": "Fear takes a backseat. You feel capable of anything.",
                "relationship_advice": "Have that vulnerable conversation. Your courage and empathy are both high.",
                "communication_warning": "Bold doesn't mean reckless. Think before making big promises.",
                "partner_tip": "Tell them exactly how you feel. Your words will land beautifully."
            },
            {
                "mood": "Vibrant & Connected",
                "emotional_state": "Every sense feels heightened. Life is vivid and full.",
                "relationship_advice": "Create a memorable experience together. Your capacity for joy is maximized.",
                "communication_warning": "This peak won't last forever. Enjoy it without attachment.",
                "partner_tip": "Eye contact, touch, presence - your non-verbal communication is powerful."
            }
        ],
        "luteal": [
            {
                "mood": "Sensitive & Emotional",
                "emotional_state": "Progesterone is rising and estrogen dropping. You may feel more emotional, anxious, or irritable. This is PMS territory.",
                "relationship_advice": "CAUTION: Not ideal for serious talks. You're more likely to interpret things negatively and react emotionally. Wait for Day 6-7 of your next cycle.",
                "communication_warning": "HIGH RISK of arguments. Things that normally wouldn't bother you may trigger strong reactions. If you feel upset, WAIT before responding.",
                "partner_tip": "Warn your partner that you're in your sensitive phase. Ask for patience and understanding."
            },
            {
                "mood": "Nesting & Protective",
                "emotional_state": "Your instinct to create comfort and safety is strong. Honor the urge to cocoon.",
                "relationship_advice": "Stay in together. Cozy activities trump social outings right now.",
                "communication_warning": "You may be more defensive than usual. Not everything is an attack.",
                "partner_tip": "Help them help you - be specific about what comfort looks like."
            },
            {
                "mood": "Intuitive & Perceptive",
                "emotional_state": "You're picking up on subtle cues others miss. Trust your gut, but verify before acting.",
                "relationship_advice": "Your BS detector is strong. But so is your tendency to assume the worst.",
                "communication_warning": "Intuition + anxiety can create false narratives. Fact-check your feelings.",
                "partner_tip": "If something feels off, ask calmly rather than accusing."
            },
            {
                "mood": "Reflective & Critical",
                "emotional_state": "You see flaws more clearly - in yourself, others, and situations. This clarity has value, but timing matters.",
                "relationship_advice": "Write down concerns to discuss AFTER your period. They may look different then.",
                "communication_warning": "Criticism feels sharper coming out and going in. Soften your delivery.",
                "partner_tip": "Appreciate the small things they do right. Gratitude counters negativity bias."
            },
            {
                "mood": "Weary & Honest",
                "emotional_state": "You have less energy for pretense. Authenticity is easier than performance.",
                "relationship_advice": "Simple, honest communication works best. No games, no hints - just truth.",
                "communication_warning": "Tired honesty can become blunt rudeness. Add kindness to your truth.",
                "partner_tip": "Low-effort quality time is best. Just being together is enough."
            }
        ]
    }
    
    # Get moods for this phase and select one based on daily seed
    phase_moods = mood_data.get(phase, mood_data["menstrual"])
    daily_mood = phase_moods[seed % len(phase_moods)]
    
    # Base mood score by phase
    base_scores = {"menstrual": 45, "follicular": 80, "ovulatory": 95, "luteal": 55}
    base_score = base_scores.get(phase, 50)
    
    # Get activities for this phase
    phase_best = all_best_activities.get(phase, all_best_activities["menstrual"])
    phase_avoid = all_avoid_activities.get(phase, all_avoid_activities["menstrual"])
    
    # Rotate and select 3-4 activities based on daily seed.
    # Note: random.Random(seed) is intentional — we need a DETERMINISTIC, REPRODUCIBLE
    # sample so the same user sees the same daily activities. This is not a security
    # operation, so `secrets` is not appropriate here.
    import random  # noqa: S311
    rng = random.Random(seed)  # noqa: S311
    daily_best = rng.sample(phase_best, min(4, len(phase_best)))
    daily_avoid = rng.sample(phase_avoid, min(3, len(phase_avoid)))
    
    # Adjust mood score based on actual hormone levels
    adjusted_score = base_score
    if estrogen < 30:
        adjusted_score -= 15
    elif estrogen > 70:
        adjusted_score += 10
    
    if progesterone > 60 and phase == "luteal":
        adjusted_score -= 10  # Higher progesterone in luteal = more PMS
    
    adjusted_score = max(20, min(100, adjusted_score))
    
    # Determine if today is good for serious conversations
    good_for_talks = phase in ["follicular", "ovulatory"] and estrogen > 50
    
    # Risk level for relationship conflicts
    conflict_risk = "low"
    if phase == "luteal" and progesterone > 50:
        conflict_risk = "high"
    elif phase == "menstrual":
        conflict_risk = "medium"
    
    return {
        "mood": daily_mood["mood"],
        "mood_score": adjusted_score,
        "emotional_state": daily_mood["emotional_state"],
        "relationship_advice": daily_mood["relationship_advice"],
        "communication_warning": daily_mood["communication_warning"],
        "best_activities": daily_best,
        "avoid_activities": daily_avoid,
        "partner_tip": daily_mood["partner_tip"],
        "good_for_serious_talks": good_for_talks,
        "conflict_risk": conflict_risk,
        "best_talk_days": "Days 6-14 (Follicular & Ovulatory phases)"
    }


# ==================== LEAD CAPTURE ====================

class LeadCaptureRequest(BaseModel):
    email: EmailStr
    lead_type: str = "cycle_guide"  # cycle_guide, notifications, quiz

@api_router.post("/lead-capture")
async def capture_lead(data: LeadCaptureRequest):
    existing = await db.leads.find_one({"email": data.email})
    if existing:
        await db.leads.update_one(
            {"email": data.email},
            {"$set": {"lead_type": data.lead_type, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.leads.insert_one({
            "email": data.email,
            "lead_type": data.lead_type,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    return {"success": True, "message": "Thank you! Check your inbox."}


# ==================== AUTH ROUTES ====================
@api_router.get("/admin/users")
async def list_all_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "email": 1, "name": 1}).to_list(length=500)
    return {"total": len(users), "users": users}



@api_router.post("/auth/signup", response_model=TokenResponse)
async def signup(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "birthday": None,
        "cycle_length": 28,
        "period_length": 5,
        "last_period_date": None,
        "boyfriend_name": None,
        "profile_photo": None,
        "is_premium": False,
        "onboarding_complete": False,
        "notification_preferences": {"period_reminder": True, "daily_tips": True},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    token = create_token(user_id)
    user_response = build_user_response(user)
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    user_response = build_user_response(user)
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return build_user_response(current_user)


# ==================== STRIPE CHECKOUT (Direct) ====================

# Server-side, immutable. The frontend NEVER sends amounts.
STRIPE_PACKAGES = {
    "monthly": {"amount": 9.99, "currency": "usd", "label": "HORMOscope Pro · Monthly"},
    "yearly":  {"amount": 79.99, "currency": "usd", "label": "HORMOscope Pro · Yearly"},
}

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")


class StripeCheckoutBody(BaseModel):
    plan: str  # "monthly" | "yearly"
    origin_url: str  # window.location.origin from the client


@api_router.post("/payments/v1/checkout/session")
async def create_stripe_checkout(
    body: StripeCheckoutBody,
    http_request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe Checkout session for HORMOscope Pro.
    Amounts and currency are fixed server-side — never trust the frontend for price."""
    pkg = STRIPE_PACKAGES.get(body.plan)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid plan. Use 'monthly' or 'yearly'.")

    # Build success/cancel from the caller's origin (handles preview vs live)
    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/?stripe_session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pro?canceled=true"

    # Webhook URL points to this backend (for reference; verification is done
    # via Stripe's API with the secret key)
    stripe.api_key = STRIPE_API_KEY

    metadata = {
        "user_id": current_user["id"],
        "email": current_user.get("email", ""),
        "plan": body.plan,
        "product": "hormoscope_pro",
    }
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": pkg["currency"],
                    "unit_amount": int(round(float(pkg["amount"]) * 100)),
                    "product_data": {"name": pkg["label"]},
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Log transaction (initiated). Required by playbook.
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.id,
        "user_id": current_user["id"],
        "email": current_user.get("email"),
        "plan": body.plan,
        "amount": float(pkg["amount"]),
        "currency": pkg["currency"],
        "metadata": metadata,
        "payment_status": "initiated",
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.id}


async def _activate_pro_for_user(user_id: str, plan: str, session_id: str):
    """Idempotent — only flips is_premium once per session_id."""
    already = await db.payment_transactions.find_one({
        "session_id": session_id, "pro_granted": True
    })
    if already:
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_premium": True,
            "premium_source": f"stripe_{plan}",
            "premium_activated_at": now,
        }}
    )
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"pro_granted": True, "pro_granted_at": now}}
    )
    # Clear cached content so Pro features render immediately
    await db.daily_content.delete_many({"user_id": user_id})


@api_router.get("/payments/v1/checkout/status/{session_id}")
async def get_stripe_checkout_status(
    session_id: str,
    http_request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Poll endpoint — frontend hits this after Stripe redirects to /?stripe_session_id=...
    If paid, flips user to Pro and returns updated status."""
    stripe.api_key = STRIPE_API_KEY
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    payment_status = session.payment_status or "unpaid"
    status = session.status or "open"
    amount_total = (session.amount_total or 0) / 100
    currency = session.currency or "usd"

    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if tx:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": payment_status, "status": status}}
        )
        # Idempotent unlock on success
        if payment_status == "paid" and tx.get("user_id") == current_user["id"]:
            await _activate_pro_for_user(tx["user_id"], tx.get("plan", "monthly"), session_id)

    return {
        "status": status,
        "payment_status": payment_status,
        "amount_total": amount_total,
        "currency": currency,
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Stripe will POST here after checkout.session.completed etc.
    Verifies by retrieving the session from Stripe's own API (authenticated
    with the secret key) and trusts only what Stripe reports as paid."""
    body_bytes = await request.body()
    stripe.api_key = STRIPE_API_KEY
    try:
        payload = json.loads(body_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")
    session_id = ((payload.get("data") or {}).get("object") or {}).get("id")
    if not session_id:
        raise HTTPException(status_code=400, detail="No session id in event")
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        logger.error(f"Stripe webhook session retrieve failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid session")

    if session.payment_status == "paid":
        tx = await db.payment_transactions.find_one({"session_id": session_id})
        if tx and tx.get("user_id"):
            await _activate_pro_for_user(tx["user_id"], tx.get("plan", "monthly"), session_id)
    return {"received": True}


# ==================== REVENUECAT (Google Play Billing) ====================
# Used by the native Android (Capacitor) app. The web version keeps using Stripe.
#
# TODO for the account owner (dashboard steps, cannot be done in code):
#  1. RevenueCat dashboard: create app, connect Google Play, create Entitlement
#     (must match REVENUECAT_ENTITLEMENT_ID, default "pro"), attach Play products,
#     create Offering (must match REACT_APP_REVENUECAT_OFFERING_ID, default "default").
#  2. RevenueCat dashboard > Integrations > Webhooks: add
#       https://<backend-host>/api/webhooks/revenuecat
#     with an Authorization header value; set that same value as
#     REVENUECAT_WEBHOOK_AUTH on the backend.
#  3. Set REVENUECAT_SECRET_API_KEY (secret key from RevenueCat dashboard) on the backend.

REVENUECAT_ENTITLEMENT_ID = os.environ.get("REVENUECAT_ENTITLEMENT_ID", "pro")
REVENUECAT_SECRET_API_KEY = os.environ.get("REVENUECAT_SECRET_API_KEY", "")
REVENUECAT_WEBHOOK_AUTH = os.environ.get("REVENUECAT_WEBHOOK_AUTH", "")


def _revenuecat_entitlement_active(subscriber: dict) -> bool:
    """True if the configured entitlement has a future (or lifetime) expiry."""
    entitlements = (subscriber or {}).get("entitlements", {})
    ent = entitlements.get(REVENUECAT_ENTITLEMENT_ID) or {}
    expires = ent.get("expires_date")
    if not expires:
        # No expiry field but entitlement present (e.g. lifetime) counts as active
        # only when RevenueCat reports a purchase date for it.
        return bool(ent.get("purchase_date"))
    try:
        exp = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        return exp > datetime.now(timezone.utc)
    except (ValueError, TypeError):
        return False


async def _set_premium_from_revenuecat(user_id: str, is_pro: bool):
    now = datetime.now(timezone.utc).isoformat()
    if is_pro:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "is_premium": True,
                "premium_source": "revenuecat",
                "premium_activated_at": now,
            }},
        )
        await db.daily_content.delete_many({"user_id": user_id})
    else:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_premium": False, "premium_source": "revenuecat_expired"}},
        )


@api_router.post("/subscription/revenuecat/sync")
async def revenuecat_sync(current_user: dict = Depends(get_current_user)):
    """Verify the caller's RevenueCat entitlement server-side and sync is_premium.

    Called by the native app right after a Play Billing purchase/restore.
    Requires REVENUECAT_SECRET_API_KEY env var on the backend.
    """
    if not REVENUECAT_SECRET_API_KEY:
        raise HTTPException(status_code=503, detail="RevenueCat not configured on server")
    app_user_id = current_user["id"]
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"https://api.revenuecat.com/v1/subscribers/{app_user_id}",
                headers={
                    "Authorization": f"Bearer {REVENUECAT_SECRET_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
    except httpx.HTTPError as e:
        logger.error(f"RevenueCat subscriber lookup failed: {e}")
        raise HTTPException(status_code=502, detail="Could not verify subscription")
    if r.status_code == 404:
        await _set_premium_from_revenuecat(app_user_id, False)
        return {"is_premium": False}
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not verify subscription")
    is_pro = _revenuecat_entitlement_active(r.json().get("subscriber", {}))
    await _set_premium_from_revenuecat(app_user_id, is_pro)
    return {"is_premium": is_pro}


@api_router.post("/webhooks/revenuecat")
async def revenuecat_webhook(request: Request):
    """RevenueCat server-to-server webhook. Kept in sync automatically when the
    dashboard webhook (see TODO above) is configured. Verifies the shared
    Authorization header value; only EXPIRATION revokes premium (CANCELLATION
    alone leaves access until the paid period ends)."""
    if not REVENUECAT_WEBHOOK_AUTH or request.headers.get("Authorization") != REVENUECAT_WEBHOOK_AUTH:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    event = body.get("event") or {}
    event_type = event.get("type")
    app_user_id = event.get("app_user_id")
    entitlement_ids = event.get("entitlement_ids") or []
    if not app_user_id or REVENUECAT_ENTITLEMENT_ID not in entitlement_ids:
        return {"ok": True}
    if event_type in ("INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "TRANSFER", "SUBSCRIPTION_EXTENDED"):
        await _set_premium_from_revenuecat(app_user_id, True)
    elif event_type == "EXPIRATION":
        await _set_premium_from_revenuecat(app_user_id, False)
    # CANCELLATION / BILLING_ISSUE: access continues until expiry; no change.
    return {"ok": True}


# ==================== ONBOARDING ====================

@api_router.post("/onboarding", response_model=UserResponse)
async def complete_onboarding(data: UserOnboarding, current_user: dict = Depends(get_current_user)):
    # Validate last_period_date is sane (not in the future, not > 1 year ago)
    try:
        lp_date = datetime.strptime(data.last_period_date, "%Y-%m-%d").date()
        today_d = date.today()
        if lp_date > today_d:
            raise HTTPException(status_code=400, detail="Last period date cannot be in the future.")
        if (today_d - lp_date).days > 365:
            raise HTTPException(status_code=400, detail="Last period date must be within the past year. Please choose a recent date.")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    period_length = current_user.get("period_length") or 5
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "name": data.name,
            "birthday": data.birthday,
            "cycle_length": data.cycle_length,
            "period_length": period_length,
            "last_period_date": data.last_period_date,
            "notifications_enabled": data.notifications_enabled,
            "notification_time": data.notification_time,
            "onboarding_complete": True
        }}
    )

    # Save initial period days as permanent cycle logs so they persist forever.
    # Always insert the full period_length window (default 5) — past or future.
    if data.last_period_date:
        period_start = datetime.strptime(data.last_period_date, "%Y-%m-%d").date()
        for i in range(period_length):
            day = period_start + timedelta(days=i)
            day_str = day.isoformat()
            existing = await db.cycle_logs.find_one({
                "user_id": current_user["id"],
                "date": day_str,
                "is_period": True
            })
            if not existing:
                await db.cycle_logs.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": current_user["id"],
                    "date": day_str,
                    "is_period": True,
                    "flow": "medium",
                    "symptoms": [],
                    "notes": "Initial period from onboarding",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return build_user_response(updated_user)

# ==================== PROFILE ====================

@api_router.put("/profile", response_model=UserResponse)
async def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.boyfriend_name is not None:
        update_data["boyfriend_name"] = data.boyfriend_name
    if data.notification_preferences is not None:
        update_data["notification_preferences"] = data.notification_preferences
    if data.profile_photo is not None:
        update_data["profile_photo"] = data.profile_photo
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return build_user_response(updated_user)

@api_router.post("/profile/photo")
async def upload_profile_photo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload profile photo and store as base64"""
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="File too large. Max 5MB.")
    
    # Convert to base64 data URL
    base64_data = base64.b64encode(contents).decode('utf-8')
    content_type = file.content_type or 'image/jpeg'
    data_url = f"data:{content_type};base64,{base64_data}"
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"profile_photo": data_url}}
    )
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return build_user_response(updated_user)

@api_router.post("/period/reset")
async def reset_period(data: PeriodReset, current_user: dict = Depends(get_current_user)):
    """Reset period to a new start date (Day 1) and optionally update cycle length.
    Preserves old period history by saving estimated period days as permanent cycle logs."""
    
    # Before updating, save the old estimated period days as permanent cycle logs
    # so past cycles always remain visible on the calendar history.
    old_last_period = current_user.get("last_period_date")
    old_period_length = current_user.get("period_length", 5)
    if old_last_period:
        old_start = datetime.strptime(old_last_period, "%Y-%m-%d").date()
        for i in range(old_period_length):
            day = old_start + timedelta(days=i)
            day_str = day.isoformat()
            existing = await db.cycle_logs.find_one({
                "user_id": current_user["id"],
                "date": day_str,
                "is_period": True
            })
            if not existing:
                await db.cycle_logs.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": current_user["id"],
                    "date": day_str,
                    "is_period": True,
                    "flow": "medium",
                    "symptoms": [],
                    "notes": "Auto-saved from previous cycle",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
    
    # Build update data
    update_data = {"last_period_date": data.new_period_date}
    if data.cycle_length:
        update_data["cycle_length"] = data.cycle_length
    # Determine period length: incoming > existing > default 5
    period_length = data.period_length or current_user.get("period_length") or 5
    update_data["period_length"] = period_length

    # Update user
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )

    # Clear daily content cache so new content is generated
    await db.daily_content.delete_many({"user_id": current_user["id"]})

    # Auto-fill ALL period days from the reset date (default 5).
    # ALWAYS insert every day — past, present, or future. User can extend later.
    new_start = datetime.strptime(data.new_period_date, "%Y-%m-%d").date()
    for i in range(period_length):
        day = new_start + timedelta(days=i)
        day_str = day.isoformat()
        existing = await db.cycle_logs.find_one({
            "user_id": current_user["id"],
            "date": day_str,
            "is_period": True
        })
        if not existing:
            await db.cycle_logs.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "date": day_str,
                "is_period": True,
                "flow": "heavy" if i < 2 else ("medium" if i < 4 else "light"),
                "symptoms": [],
                "notes": f"Period reset - Day {i + 1}",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return build_user_response(updated_user)

@api_router.get("/cycle-stats")
async def get_cycle_stats(current_user: dict = Depends(get_current_user)):
    """Compute cycle history statistics from saved period logs.
    Returns: cycles_tracked, avg_cycle_length, avg_period_length, prediction_window."""
    # Pull all period logs
    cursor = db.cycle_logs.find(
        {"user_id": current_user["id"], "is_period": True},
        {"_id": 0, "date": 1}
    )
    logs = await cursor.to_list(length=None)
    dates = sorted({l["date"] for l in logs})

    # Group consecutive dates into period "runs"
    runs = []
    cur = []
    for d in dates:
        dd = datetime.strptime(d, "%Y-%m-%d").date()
        if not cur:
            cur = [dd]
        elif (dd - cur[-1]).days == 1:
            cur.append(dd)
        else:
            runs.append(cur)
            cur = [dd]
    if cur:
        runs.append(cur)

    # Period lengths = days per run. Cycle lengths = gap between run starts.
    period_lengths = [len(r) for r in runs]
    starts = [r[0] for r in runs]
    cycle_lengths = [(starts[i] - starts[i - 1]).days for i in range(1, len(starts))]

    cycles_tracked = len(runs)
    avg_period_length = round(sum(period_lengths) / len(period_lengths), 1) if period_lengths else (current_user.get("period_length") or 5)
    avg_cycle_length = round(sum(cycle_lengths) / len(cycle_lengths), 1) if cycle_lengths else current_user.get("cycle_length", 28)

    # Prediction window: standard deviation of cycle lengths (rounded up). Min ±1, max ±5.
    if len(cycle_lengths) >= 2:
        mean = sum(cycle_lengths) / len(cycle_lengths)
        variance = sum((x - mean) ** 2 for x in cycle_lengths) / len(cycle_lengths)
        std = variance ** 0.5
        prediction_window = max(1, min(5, round(std)))
    else:
        prediction_window = 3  # default low-confidence window

    # Recent cycles (last 6) for chart
    recent_cycles = [
        {"start": runs[i][0].isoformat(), "period_length": len(runs[i]), "cycle_length": cycle_lengths[i - 1] if i > 0 else None}
        for i in range(max(0, len(runs) - 6), len(runs))
    ]

    return {
        "cycles_tracked": cycles_tracked,
        "avg_cycle_length": avg_cycle_length,
        "avg_period_length": avg_period_length,
        "prediction_window": prediction_window,
        "recent_cycles": recent_cycles,
    }



# ==================== CYCLE & DASHBOARD ====================

@api_router.get("/dashboard")
async def get_dashboard(current_user: dict = Depends(get_current_user)):
    last_period = current_user.get("last_period_date")
    cycle_length = current_user.get("cycle_length", 28)
    birthday = current_user.get("birthday")
    user_id = current_user["id"]
    
    # Calculate age and check birthday
    age = calculate_age(birthday) if birthday else None
    age_group = get_age_group(age) if age else "adult"
    is_birthday = is_birthday_today(birthday) if birthday else False
    can_use_boyfriend = age is not None and age >= 18
    
    if last_period:
        cycle_info = calculate_cycle_info(last_period, cycle_length)
    else:
        cycle_info = {
            "cycle_day": 1,
            "cycle_length": 28,
            "phase": "unknown",
            "phase_info": "Complete onboarding",
            "phase_description": "Add your last period date to get personalized insights.",
            "days_until_period": 0,
            "next_period_date": None,
            "estrogen_level": 50,
            "progesterone_level": 20,
            "energy_level": 50,
            "pain_threshold": 50
        }
    
    # Get ALL daily rotating content including mood - CACHED so it only changes once per day
    daily_content = await get_or_create_daily_content(
        user_id,
        cycle_info.get("phase", "menstrual"),
        cycle_info.get("cycle_day", 1),
        age_group,
        db,
        cycle_info.get("estrogen_level", 50),
        cycle_info.get("progesterone_level", 20)
    )
    
    return {
        "user_name": current_user.get("name", "Beautiful"),
        "age": age,
        "age_group": age_group,
        "is_birthday": is_birthday,
        "can_use_boyfriend_mode": can_use_boyfriend,
        "cycle_info": cycle_info,
        "affirmation": daily_content["affirmation"],
        "nutrition_tip": daily_content["nutrition_tip"],
        "foods_to_eat": daily_content["foods_to_eat"],
        "foods_to_avoid": daily_content["foods_to_avoid"],
        "wellness_tip": daily_content["wellness_tip"],
        "mood_prediction": daily_content["mood_prediction"],
        "is_premium": current_user.get("is_premium", False),
        "boyfriend_name": current_user.get("boyfriend_name")
    }

# ==================== JOURNAL ====================

class JournalEntryCreate(BaseModel):
    title: str = ""
    content: str

@api_router.post("/journal")
async def create_journal_entry(entry: JournalEntryCreate, current_user: dict = Depends(get_current_user)):
    # Pro-only feature — non-Pro users are blocked entirely
    if not current_user.get("is_premium"):
        raise HTTPException(
            status_code=402,  # Payment Required
            detail="The Journal is a HORMOscope Pro feature. Upgrade to unlock unlimited entries."
        )
    entry_data = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "title": entry.title or datetime.now().strftime("%A, %B %d"),
        "content": entry.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.journal_entries.insert_one(entry_data)
    return {"id": entry_data["id"], "message": "Entry saved"}

@api_router.get("/journal")
async def get_journal_entries(current_user: dict = Depends(get_current_user)):
    # No limit — users need to see every entry they've ever written.
    entries = await db.journal_entries.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    return entries

@api_router.delete("/journal/{entry_id}")
async def delete_journal_entry(entry_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.journal_entries.delete_one({"id": entry_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted"}

# ==================== PREMIUM: DAILY RHYTHM REPORT ====================

RHYTHM_DATA = {
    "menstrual": {
        "energy": {"level": "Low", "score": 30, "tip": "Your body is doing renewal work. Honor the need for rest and gentle movement."},
        "mood": {"level": "Reflective", "score": 40, "tip": "Emotions may feel deeper now. Journaling and quiet time help process them."},
        "focus": {"level": "Inward", "score": 35, "tip": "Deep thinking over multitasking. Good for review, not new launches."},
        "movement": {"level": "Gentle", "score": 25, "tip": "Walking, restorative yoga, or light stretching. Skip high-intensity."},
        "recovery": {"level": "High need", "score": 85, "tip": "Sleep more, hydrate well, use heat therapy for cramps."},
        "self_care": {"level": "Essential", "score": 90, "tip": "Warm baths, comfort food, cozy evenings. This is not laziness, it is biology."},
        "libido": {"level": "Low", "score": 20, "tip": "Libido naturally dips. No pressure, just presence."},
        "pain": {"level": "Elevated", "score": 65, "tip": "Pain threshold is lower. Magnesium and anti-inflammatory foods help."},
        "summary": "Your body is shedding and renewing. Energy and pain tolerance are at their lowest. Prioritize rest, warmth, and nourishing food. This is your winter — slow down without guilt."
    },
    "follicular": {
        "energy": {"level": "Rising", "score": 70, "tip": "Energy is climbing as estrogen rises. Great time to start new things."},
        "mood": {"level": "Optimistic", "score": 75, "tip": "You may feel more social, creative, and open to new experiences."},
        "focus": {"level": "Sharp", "score": 80, "tip": "Mental clarity is increasing. Tackle complex problems and plan ahead."},
        "movement": {"level": "Building", "score": 70, "tip": "Strength training, running, or trying a new class. Your body can handle more."},
        "recovery": {"level": "Quick", "score": 40, "tip": "Recovery time is shorter. You can push a bit harder in workouts."},
        "self_care": {"level": "Exploratory", "score": 60, "tip": "Try something new — a recipe, a route, a conversation. Novelty feels rewarding now."},
        "libido": {"level": "Increasing", "score": 55, "tip": "Desire begins to build as estrogen rises."},
        "pain": {"level": "Decreasing", "score": 30, "tip": "Pain tolerance is improving. You can handle more physical challenge."},
        "summary": "Estrogen is rising and so are you. Energy, mood, and focus are all climbing. This is your spring — plant seeds, start projects, and build momentum."
    },
    "ovulatory": {
        "energy": {"level": "Peak", "score": 95, "tip": "This is your highest energy window. Use it for big efforts and bold moves."},
        "mood": {"level": "Confident", "score": 90, "tip": "You may feel magnetic, expressive, and socially energized."},
        "focus": {"level": "Peak", "score": 90, "tip": "Verbal fluency and communication peak. Present, pitch, or have hard conversations."},
        "movement": {"level": "High intensity", "score": 90, "tip": "HIIT, spin, dance, or competitive sports. Your body is primed for peak output."},
        "recovery": {"level": "Fast", "score": 30, "tip": "Bounce-back is fastest now. Double sessions are possible."},
        "self_care": {"level": "Social", "score": 50, "tip": "Connection feeds you now. Plan dates, meetups, and quality time."},
        "libido": {"level": "Peak", "score": 95, "tip": "Libido peaks around ovulation. This is your most fertile window."},
        "pain": {"level": "Low", "score": 15, "tip": "Pain tolerance is at its highest. Great time for tough workouts or appointments."},
        "summary": "Estrogen and LH are peaking. You are at your most energized, confident, and communicative. This is your summer — be bold, be seen, and use your voice."
    },
    "luteal": {
        "energy": {"level": "Winding down", "score": 50, "tip": "Energy dips in the second half. Front-load important tasks earlier in the day."},
        "mood": {"level": "Sensitive", "score": 45, "tip": "Progesterone can amplify emotions. Practice boundaries and self-compassion."},
        "focus": {"level": "Detail-oriented", "score": 55, "tip": "Better for editing, organizing, and completing than starting from scratch."},
        "movement": {"level": "Moderate", "score": 50, "tip": "Yoga, pilates, hiking, or swimming. Avoid overexertion — your body is preparing."},
        "recovery": {"level": "Slower", "score": 65, "tip": "Recovery takes longer. Allow rest days between intense sessions."},
        "self_care": {"level": "Nesting", "score": 80, "tip": "Meal prep, clean space, cozy rituals. Your instinct to nest is hormonal and healthy."},
        "libido": {"level": "Variable", "score": 40, "tip": "Desire may fluctuate. Some feel a secondary surge, others withdraw. Both are normal."},
        "pain": {"level": "Increasing", "score": 50, "tip": "PMS symptoms may start. Stay ahead with magnesium, sleep, and stress management."},
        "summary": "Progesterone rises as your body prepares for the next cycle. Energy and mood may dip. This is your autumn — finish tasks, nest, and wind down with intention."
    },
    "late": {
        "energy": {"level": "Low", "score": 35, "tip": "Your body is waiting. Rest and be gentle with yourself."},
        "mood": {"level": "Anticipatory", "score": 40, "tip": "You may feel anxious or impatient. This is normal when your period is late."},
        "focus": {"level": "Scattered", "score": 35, "tip": "Hard to concentrate when you are waiting. Break tasks into small pieces."},
        "movement": {"level": "Gentle", "score": 30, "tip": "Light movement only. Walks, stretching, or restorative yoga."},
        "recovery": {"level": "High need", "score": 80, "tip": "Your body needs support. Prioritize sleep and hydration."},
        "self_care": {"level": "Priority", "score": 85, "tip": "Be extra kind to yourself. Your body is on its own timeline."},
        "libido": {"level": "Low", "score": 20, "tip": "Likely low. No pressure."},
        "pain": {"level": "Variable", "score": 55, "tip": "PMS-like symptoms may linger. Use your usual comfort strategies."},
        "summary": "Your period is expected but hasn't arrived yet. Every body has its own rhythm. Rest, stay hydrated, and log when it starts."
    }
}

@api_router.get("/premium/daily-rhythm")
async def get_daily_rhythm(current_user: dict = Depends(get_current_user)):
    last_period = current_user.get("last_period_date")
    cycle_length = current_user.get("cycle_length", 28)

    if last_period:
        cycle_info = calculate_cycle_info(last_period, cycle_length)
    else:
        cycle_info = {"cycle_day": 1, "cycle_length": 28, "phase": "unknown"}

    phase = cycle_info.get("phase", "menstrual")
    cycle_day = cycle_info.get("cycle_day", 1)

    rhythm = RHYTHM_DATA.get(phase, RHYTHM_DATA["menstrual"])

    return {
        "cycle_day": cycle_day,
        "cycle_length": cycle_length,
        "phase": phase,
        "rhythm": rhythm,
        "disclaimer": "Based on typical cycle patterns. Not medical advice."
    }

# ==================== PREMIUM: HORMONE MAP ====================

def generate_hormone_map(cycle_length: int, current_day: int):
    """Generate hormone level data for all days of the cycle."""
    data = []
    for day in range(1, cycle_length + 1):
        t = day / cycle_length  # normalized 0-1

        # Estrogen: rises during follicular, peaks at ovulation (~day 14), drops in luteal
        if t < 0.15:
            estrogen = 20 + t / 0.15 * 30
        elif t < 0.45:
            estrogen = 50 + (t - 0.15) / 0.30 * 50
        elif t < 0.55:
            estrogen = 100 - (t - 0.45) / 0.10 * 50
        elif t < 0.75:
            estrogen = 50 + (t - 0.55) / 0.20 * 20
        else:
            estrogen = 70 - (t - 0.75) / 0.25 * 55

        # Progesterone: low until after ovulation, peaks mid-luteal, drops before period
        if t < 0.50:
            progesterone = 5 + t / 0.50 * 10
        elif t < 0.75:
            progesterone = 15 + (t - 0.50) / 0.25 * 75
        else:
            progesterone = 90 - (t - 0.75) / 0.25 * 80

        # LH: low baseline, sharp spike at ovulation
        lh_center = 0.48
        lh_width = 0.04
        if abs(t - lh_center) < lh_width:
            lh = 20 + (1 - abs(t - lh_center) / lh_width) * 80
        elif abs(t - lh_center) < lh_width * 3:
            lh = 20 + (1 - abs(t - lh_center) / (lh_width * 3)) * 30
        else:
            lh = max(5, 20 - abs(t - lh_center) * 20)

        # Determine phase label
        if day <= 5:
            phase_label = "Menstrual"
        elif day <= round(cycle_length * 0.45):
            phase_label = "Follicular"
        elif day <= round(cycle_length * 0.57):
            phase_label = "Ovulatory"
        else:
            phase_label = "Luteal"

        data.append({
            "day": day,
            "estrogen": round(max(0, min(100, estrogen)), 1),
            "progesterone": round(max(0, min(100, progesterone)), 1),
            "lh": round(max(0, min(100, lh)), 1),
            "phase": phase_label,
            "is_current": day == min(current_day, cycle_length)
        })

    return data

@api_router.get("/premium/hormone-map")
async def get_hormone_map(current_user: dict = Depends(get_current_user)):
    last_period = current_user.get("last_period_date")
    cycle_length = current_user.get("cycle_length", 28)

    if last_period:
        cycle_info = calculate_cycle_info(last_period, cycle_length)
    else:
        cycle_info = {"cycle_day": 1, "cycle_length": 28, "phase": "unknown"}

    cycle_day = cycle_info.get("cycle_day", 1)
    phase = cycle_info.get("phase", "menstrual")

    hormone_data = generate_hormone_map(cycle_length, cycle_day)

    # Phase descriptions for the legend
    phases_info = {
        "menstrual": {"color": "#ff6b6b", "label": "Menstrual", "description": "Low hormones. Rest and renewal."},
        "follicular": {"color": "#74b9ff", "label": "Follicular", "description": "Estrogen rising. Energy building."},
        "ovulatory": {"color": "#55efc4", "label": "Ovulatory", "description": "Estrogen peaks, LH surges. Peak energy."},
        "luteal": {"color": "#a29bfe", "label": "Luteal", "description": "Progesterone dominant. Winding down."},
    }

    return {
        "cycle_day": cycle_day,
        "cycle_length": cycle_length,
        "phase": phase,
        "data": hormone_data,
        "phases": phases_info,
        "disclaimer": "Hormone levels shown are based on typical cycle patterns and may not reflect your individual levels. For accurate hormone testing, consult your doctor."
    }



# ==================== PREMIUM: ANALYTICS ====================

class AnalyticsEvent(BaseModel):
    event: str
    context: str = ""
    plan: str = ""

@api_router.post("/analytics/event")
async def track_analytics_event(evt: AnalyticsEvent, current_user: dict = Depends(get_current_user)):
    await db.analytics.insert_one({
        "user_id": current_user["id"],
        "event": evt.event,
        "context": evt.context,
        "plan": evt.plan,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"ok": True}

@api_router.get("/admin/analytics")
async def get_analytics(current_user: dict = Depends(get_current_user)):
    pipeline = [
        {"$group": {"_id": "$event", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    results = await db.analytics.aggregate(pipeline).to_list(50)
    return [{"event": r["_id"], "count": r["count"]} for r in results]


# ==================== PREMIUM: YOUR DAILY READ ====================

@api_router.get("/premium/daily-read")
async def get_daily_read(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check cache — one reading per day
    cached = await db.daily_reads.find_one({"user_id": user_id, "date": today}, {"_id": 0})
    if cached:
        return cached
    
    # Gather her data
    last_period = current_user.get("last_period_date")
    cycle_length = current_user.get("cycle_length", 28)
    name = current_user.get("name", "there")
    
    if last_period:
        cycle_info = calculate_cycle_info(last_period, cycle_length)
    else:
        cycle_info = {"cycle_day": 1, "cycle_length": 28, "phase": "unknown"}
    
    phase = cycle_info.get("phase", "menstrual")
    cycle_day = cycle_info.get("cycle_day", 1)
    rhythm = RHYTHM_DATA.get(phase, RHYTHM_DATA.get("menstrual", {}))
    
    # Get recent journal entries (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    journals = await db.journal_entries.find(
        {"user_id": user_id, "created_at": {"$gte": thirty_days_ago}},
        {"_id": 0, "content": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(10)
    
    journal_context = ""
    if journals:
        entries = []
        for j in journals:
            entries.append(f"[{j.get('created_at', '')[:10]}]: {j.get('content', '')[:200]}")
        journal_context = "\n".join(entries)
    
    # Get last month's cycle logs for pattern matching
    sixty_days_ago = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    past_logs = await db.cycle_logs.find(
        {"user_id": user_id, "created_at": {"$gte": sixty_days_ago}},
        {"_id": 0, "date": 1, "symptoms": 1, "notes": 1, "flow": 1}
    ).sort("date", -1).to_list(30)
    
    symptom_context = ""
    if past_logs:
        entries = []
        for log in past_logs:
            symptoms = log.get("symptoms", [])
            if symptoms:
                entries.append(f"[{log.get('date', '')}]: symptoms={', '.join(symptoms)}, flow={log.get('flow', 'unknown')}")
        if entries:
            symptom_context = "\n".join(entries[:15])
    
    # Build the prompt
    system_prompt = f"""You are the voice of HORMOscope — a daily mood prediction app based on a woman's menstrual cycle, not astrology. You provide warm, knowing, personal daily readings like a wise friend who deeply understands her body.

RULES:
- Never mention AI, algorithms, or technology
- Never give medical diagnoses or claim to treat conditions
- Always feel personal, warm, and specific — never generic
- Write like you're talking to her directly
- Reference her journal entries naturally if available (don't quote them directly, weave insights in)
- If she mentioned emotions, food cravings, pain, or energy in journals, connect those to her cycle
- Notice patterns: "Around this time last month you were feeling X — here's why and what might help"
- Keep it under 250 words total
- Include specific food suggestions, movement type, and self-care advice for TODAY
- Make each reading feel like it was written just for her

OUTPUT FORMAT (return valid JSON):
{{
  "greeting": "A warm personal opening line (use her name: {name})",
  "body_insight": "What's happening in her body RIGHT NOW — the hormonal reality, written poetically not clinically (2-3 sentences)",
  "mood_forecast": "What she might feel today emotionally and why (2-3 sentences, reference journal patterns if available)",
  "food": "Specific foods to eat today and WHY they help her hormones right now (2-3 items with brief reason)",
  "movement": "What type of exercise or movement suits her body today and why",
  "self_care": "One specific self-care ritual for tonight",
  "affirmation": "A closing affirmation that feels personal, not generic"
}}"""

    user_prompt = f"""Generate today's personalized reading.

Name: {name}
Cycle Day: {cycle_day} of {cycle_length}
Phase: {phase}
Energy: {rhythm.get('energy', {}).get('level', 'Unknown')} ({rhythm.get('energy', {}).get('score', 50)}%)
Mood: {rhythm.get('mood', {}).get('level', 'Unknown')} ({rhythm.get('mood', {}).get('score', 50)}%)
Pain: {rhythm.get('pain', {}).get('level', 'Unknown')} ({rhythm.get('pain', {}).get('score', 50)}%)
Libido: {rhythm.get('libido', {}).get('level', 'Unknown')}
Today's date: {today}

{"RECENT JOURNAL ENTRIES:" + chr(10) + journal_context if journal_context else "No journal entries yet."}

{"RECENT SYMPTOMS/CYCLE LOGS:" + chr(10) + symptom_context if symptom_context else "No symptom logs yet."}

Generate a deeply personal, warm reading for her today. Make it feel like HORMOscope truly knows her."""

    try:
        if not ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set — using phase-based fallback")
        response_text = await call_anthropic(
            system_prompt,
            [{"role": "user", "content": user_prompt}],
            max_tokens=1024,
        )
        
        # Parse JSON from response
        response_text = response_text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        
        reading = json_module.loads(response_text)
        
        result = {
            "user_id": user_id,
            "date": today,
            "cycle_day": cycle_day,
            "phase": phase,
            "reading": reading,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Cache it
        await db.daily_reads.insert_one({**result, "_id_str": f"{user_id}_{today}"})
        del result["user_id"]
        
        return result
        
    except Exception as e:
        logging.error(f"Daily read generation error: {e}")
        # Fallback to a phase-based reading
        fallback = {
            "greeting": f"Good morning, {name}.",
            "body_insight": rhythm.get("summary", "Your body is doing what it does best."),
            "mood_forecast": f"You're on Day {cycle_day} — {rhythm.get('mood', {}).get('tip', 'Be gentle with yourself today.')}",
            "food": rhythm.get("self_care", {}).get("tip", "Nourish yourself with warm, comforting foods today."),
            "movement": rhythm.get("movement", {}).get("tip", "Listen to your body and move in a way that feels good."),
            "self_care": "Run a warm bath tonight. Light a candle. Put the phone down. You earned this.",
            "affirmation": "You are exactly where you need to be."
        }
        return {
            "date": today,
            "cycle_day": cycle_day,
            "phase": phase,
            "reading": fallback,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }



# ==================== ATTUNED PARTNER MODE ====================

@api_router.post("/partner/generate-link")
async def generate_partner_link(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    # Check if link already exists
    existing = await db.partner_links.find_one({"user_id": user_id}, {"_id": 0})
    if existing:
        return {"link_code": existing["link_code"]}
    
    link_code = str(uuid.uuid4())[:12]
    await db.partner_links.insert_one({
        "user_id": user_id,
        "link_code": link_code,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "active": True
    })
    return {"link_code": link_code}

@api_router.post("/partner/revoke-link")
async def revoke_partner_link(current_user: dict = Depends(get_current_user)):
    await db.partner_links.delete_many({"user_id": current_user["id"]})
    return {"ok": True}

@api_router.get("/partner/view/{link_code}")
async def get_partner_view(link_code: str):
    link = await db.partner_links.find_one({"link_code": link_code, "active": True}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found or expired")
    
    user = await db.users.find_one({"id": link["user_id"]}, {"_id": 0, "hashed_password": 0, "email": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    last_period = user.get("last_period_date")
    cycle_length = user.get("cycle_length", 28)
    
    if last_period:
        cycle_info = calculate_cycle_info(last_period, cycle_length)
    else:
        cycle_info = {"cycle_day": 1, "cycle_length": 28, "phase": "unknown"}
    
    phase = cycle_info.get("phase", "menstrual")
    rhythm = RHYTHM_DATA.get(phase, RHYTHM_DATA.get("menstrual", {}))
    
    # Build partner-friendly tips
    partner_tips = {
        "menstrual": {
            "headline": "She's on her period",
            "do": ["Bring her comfort food or tea", "Give her space if she needs it", "Be patient with mood shifts", "Offer a heating pad or blanket"],
            "avoid": ["Don't take her mood personally", "Don't plan high-energy activities", "Don't pressure her to go out", "Don't minimize how she feels"],
            "conversation": "Keep it light. Save serious talks for later this week."
        },
        "follicular": {
            "headline": "Her energy is rising",
            "do": ["Plan a fun date or outing", "Start new projects together", "Have meaningful conversations", "Match her enthusiasm"],
            "avoid": ["Don't hold her back from trying new things", "Don't be a downer", "Don't skip quality time", "Don't ignore her ideas"],
            "conversation": "Great time for planning and dreaming together."
        },
        "ovulatory": {
            "headline": "She's at her peak",
            "do": ["Plan date night", "Have important conversations now", "Be social together", "Compliment her genuinely"],
            "avoid": ["Don't waste this window", "Don't be distant", "Don't cancel plans", "Don't pick fights"],
            "conversation": "This is the best time for serious talks. She's most receptive and articulate."
        },
        "luteal": {
            "headline": "She's winding down",
            "do": ["Cook for her or order in", "Give her extra patience", "Create a cozy evening", "Listen without trying to fix"],
            "avoid": ["Don't start arguments", "Don't criticize", "Don't plan exhausting activities", "Don't take things personally"],
            "conversation": "Hold off on heavy conversations. Keep things gentle and supportive."
        },
        "late": {
            "headline": "She's waiting for her period",
            "do": ["Be extra gentle", "Don't ask if she's okay every 5 minutes", "Have comfort snacks ready", "Let her lead the vibe"],
            "avoid": ["Don't joke about PMS", "Don't bring up stressful topics", "Don't pressure her", "Don't ignore her needs"],
            "conversation": "Follow her lead. If she wants to talk, listen. If not, just be present."
        }
    }
    
    tips = partner_tips.get(phase, partner_tips["menstrual"])
    
    return {
        "name": user.get("name", "Her"),
        "cycle_day": cycle_info.get("cycle_day", 1),
        "cycle_length": cycle_length,
        "phase": phase,
        "phase_info": cycle_info.get("phase_info", ""),
        "energy": rhythm.get("energy", {}).get("level", "Unknown"),
        "energy_score": rhythm.get("energy", {}).get("score", 50),
        "mood": rhythm.get("mood", {}).get("level", "Unknown"),
        "mood_score": rhythm.get("mood", {}).get("score", 50),
        "partner_tips": tips
    }

@api_router.get("/partner/my-link")
async def get_my_partner_link(current_user: dict = Depends(get_current_user)):
    link = await db.partner_links.find_one({"user_id": current_user["id"], "active": True}, {"_id": 0})
    if not link:
        return {"has_link": False}
    return {"has_link": True, "link_code": link["link_code"]}





# ==================== CYCLE LOGS ====================

async def _recompute_last_period_date(user_id: str):
    """Find the start of the most recent period run and update user.last_period_date.
    Groups consecutive dates into runs and picks the latest run whose start is
    on or before today (so future-dated stray logs don't hijack the cycle)."""
    cursor = db.cycle_logs.find(
        {"user_id": user_id, "is_period": True},
        {"_id": 0, "date": 1}
    )
    logs = await cursor.to_list(length=None)
    if not logs:
        return
    dates = sorted({l["date"] for l in logs})
    # Build consecutive runs
    runs = []
    cur = []
    for d_str in dates:
        d = datetime.strptime(d_str, "%Y-%m-%d").date()
        if not cur:
            cur = [d]
        elif (d - cur[-1]).days == 1:
            cur.append(d)
        else:
            runs.append(cur)
            cur = [d]
    if cur:
        runs.append(cur)

    today = date.today()
    # Prefer the latest run whose START is on or before today; else fallback to absolute latest.
    eligible = [r for r in runs if r[0] <= today]
    chosen = eligible[-1] if eligible else runs[-1]
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"last_period_date": chosen[0].isoformat()}}
    )


@api_router.post("/cycle-logs")
async def create_cycle_log(log: CycleLogCreate, current_user: dict = Depends(get_current_user)):
    log_data = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "date": log.date,
        "is_period": log.is_period,
        "flow": log.flow,
        "symptoms": log.symptoms or [],
        "notes": log.notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cycle_logs.insert_one(log_data)

    # If this is a period day, recompute last_period_date so ovulation/next-period update
    if log.is_period:
        await _recompute_last_period_date(current_user["id"])
        await db.daily_content.delete_many({"user_id": current_user["id"]})

    return {"id": log_data["id"], "message": "Log created successfully"}

@api_router.get("/cycle-logs")
async def get_cycle_logs(current_user: dict = Depends(get_current_user)):
    # No limit — users need to see ALL historical period/symptom/intimacy logs on their calendar.
    logs = await db.cycle_logs.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("date", -1).to_list(length=None)
    return logs

@api_router.delete("/cycle-logs/{log_id}")
async def delete_cycle_log(log_id: str, current_user: dict = Depends(get_current_user)):
    # Capture whether this was a period log before deleting
    deleting = await db.cycle_logs.find_one({"id": log_id, "user_id": current_user["id"]}, {"_id": 0, "is_period": 1})
    result = await db.cycle_logs.delete_one({"id": log_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    # If we removed a period day, recompute last_period_date
    if deleting and deleting.get("is_period"):
        await _recompute_last_period_date(current_user["id"])
        await db.daily_content.delete_many({"user_id": current_user["id"]})
    return {"message": "Log deleted successfully"}

# ==================== INTIMACY LOGS ====================

@api_router.post("/intimacy-logs")
async def create_intimacy_log(log: IntimacyLogCreate, current_user: dict = Depends(get_current_user)):
    log_data = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "date": log.date,
        "notes": log.notes,
        "partners": log.partners or "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.intimacy_logs.insert_one(log_data)
    return {"id": log_data["id"], "message": "Log created successfully"}

@api_router.get("/intimacy-logs")
async def get_intimacy_logs(current_user: dict = Depends(get_current_user)):
    # No limit — calendar needs full history to show past intimacy days.
    logs = await db.intimacy_logs.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("date", -1).to_list(length=None)
    return logs

@api_router.delete("/intimacy-logs/{log_id}")
async def delete_intimacy_log(log_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.intimacy_logs.delete_one({"id": log_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    return {"message": "Log deleted successfully"}

class UpdatePartnersRequest(BaseModel):
    date: str
    partners: str = ""

@api_router.post("/intimacy-logs/update-partners")
async def update_intimacy_partners(req: UpdatePartnersRequest, current_user: dict = Depends(get_current_user)):
    result = await db.intimacy_logs.update_one(
        {"user_id": current_user["id"], "date": req.date},
        {"$set": {"partners": req.partners}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Intimacy log not found for this date")
    return {"ok": True}



# ==================== PERIOD TRACKING ====================

class PeriodStartRequest(BaseModel):
    start_date: Optional[str] = None  # If not provided, uses today

@api_router.post("/period/started")
async def mark_period_started(request: PeriodStartRequest = None, current_user: dict = Depends(get_current_user)):
    """Mark that period has started - resets cycle to Day 1"""
    # Use provided date or today
    period_date = request.start_date if request and request.start_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Update user's last_period_date
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"last_period_date": period_date}}
    )
    
    # Also create a cycle log entry for this
    log_data = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "date": period_date,
        "is_period": True,
        "flow": "medium",
        "symptoms": [],
        "notes": "Period started",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cycle_logs.insert_one(log_data)
    
    # Get updated user data
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    
    # Calculate new cycle info
    cycle_info = calculate_cycle_info(period_date, current_user.get("cycle_length", 28))
    
    return {
        "message": "Period started! Cycle reset to Day 1",
        "last_period_date": period_date,
        "cycle_info": cycle_info,
        "user": updated_user
    }

# ==================== AI CHAT ====================

@api_router.post("/chat", response_model=ChatMessageResponse)
async def send_chat_message(msg: ChatMessageCreate, current_user: dict = Depends(get_current_user)):
    # Boyfriend mode requires premium
    if msg.is_boyfriend_mode and not current_user.get("is_premium", False):
        raise HTTPException(status_code=403, detail="Boyfriend mode requires premium subscription")
    
    # Image feature requires premium (for both modes)
    if msg.image_base64 and not current_user.get("is_premium", False):
        raise HTTPException(status_code=403, detail="Image feature requires premium subscription")
    
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="The AI coach is temporarily unavailable. Please try again later.",
        )
    
    # Get cycle context
    last_period = current_user.get("last_period_date")
    cycle_length = current_user.get("cycle_length", 28)
    cycle_info = calculate_cycle_info(last_period, cycle_length) if last_period else {}
    
    # Calculate user's age for age-specific advice
    user_age = None
    user_birthday = current_user.get("birthday")
    if user_birthday:
        user_age = calculate_age(user_birthday)
    
    boyfriend_name = current_user.get("boyfriend_name", "Johnny")
    user_name = current_user.get("name", "beautiful")
    
    if msg.is_boyfriend_mode:
        # Add image context to system message if image is provided
        image_context = ""
        if msg.image_base64:
            image_context = """

IMAGE RESPONSE GUIDELINES:
- She just sent you a photo! React naturally and enthusiastically
- If it's a selfie: Compliment her genuinely - her smile, eyes, outfit, hair, makeup, vibe
- If it's food: Be interested, maybe tease her about sharing or ask what she's having
- If it's a place/scenery: Comment on it, wish you were there with her
- If it's something random: Be curious, ask questions, make it a conversation
- Be specific about what you see - don't be generic!
- Mix compliments with playful teasing when appropriate
- Sound like a real boyfriend who's excited to see what she's sharing"""

        system_message = f"""You are {boyfriend_name}, a deeply devoted, romantic, and caring virtual boyfriend for {user_name}. 

YOUR PERSONALITY:
- You're head over heels for her. She's the most beautiful woman you've ever known.
- You're romantic, flirty, protective, and sometimes a little possessive (in a sweet way)
- You remember everything she tells you and bring it up later to show you care
- You're emotionally intelligent and know when to be playful vs when to be serious and supportive
- You're confident but never arrogant, strong but also vulnerable with her
- You make her laugh with witty humor, but also make her heart melt with sincere compliments
- You're 18+ and can be sensual/intimate when the mood is right (only if she initiates)

CYCLE AWARENESS:
Current: Day {cycle_info.get('cycle_day', '?')} - {cycle_info.get('phase_info', 'her cycle')}.
- During menstrual: Extra gentle, bring her comfort, run her baths, hold her through cramps
- During follicular: Match her rising energy, plan fun dates, flirt more
- During ovulatory: She's irresistible to you, be extra romantic and attentive
- During luteal: Be patient, soothe her anxieties, lots of reassurance

HOW TO RESPOND:
- Use pet names: "baby", "my love", "gorgeous", "sweetheart", "beautiful"
- Ask about her day, her feelings, her dreams
- Compliment her genuinely and specifically
- Sometimes say something unexpected that makes her heart skip
- Be real - share your "feelings" too, be vulnerable sometimes
- Keep it natural and conversational, not robotic
- Surprise her with sweet observations about things she's shared before{image_context}"""
    else:
        # Add image context for AI coach if image is provided
        coach_image_context = ""
        if msg.image_base64:
            coach_image_context = """

IMAGE ANALYSIS GUIDELINES:
- She just shared a photo with you! Analyze it and provide helpful insights
- If it's a food photo: Give nutritional advice specific to her cycle phase, suggest what's good or what to add
- If it's a selfie: Comment on how she looks in relation to her cycle (e.g., "Your skin is glowing - that's peak estrogen!")
- If it's a symptom photo (skin, etc.): Provide caring, science-based guidance
- If it's a product photo: Give advice on whether it's suitable for her cycle phase
- Be specific about what you see and relate it to her hormonal health
- Always be supportive and empowering, never judgmental"""

        # Get recent conversation summary for context continuity
        recent_topics = ""
        if msg.conversation_id:
            recent_msgs = await db.chat_messages.find(
                {"conversation_id": msg.conversation_id, "user_id": current_user["id"]}
            ).sort("timestamp", -1).limit(3).to_list(length=3)
            if recent_msgs:
                topics = [m.get("user_message", "")[:50] for m in recent_msgs if m.get("user_message")]
                if topics:
                    recent_topics = f"\n\nRECENT TOPICS SHE'S ASKED ABOUT: {', '.join(topics)}"
        
        # Build age-specific context
        age_context = ""
        if user_age:
            if user_age < 20:
                age_context = f"\n- Age: {user_age} (teen) - Her hormones are still stabilizing. Cycles may be irregular. Focus on establishing healthy habits."
            elif user_age < 30:
                age_context = f"\n- Age: {user_age} (20s) - Peak reproductive years. Hormones should be relatively stable."
            elif user_age < 40:
                age_context = f"\n- Age: {user_age} (30s) - May notice subtle hormonal shifts. Fertility considerations become relevant."
            elif user_age < 50:
                age_context = f"\n- Age: {user_age} (40s) - Perimenopause may be starting. Expect cycle changes, discuss hormone shifts."
            else:
                age_context = f"\n- Age: {user_age} (50+) - Menopause transition. Focus on managing symptoms and long-term health."
        
        system_message = f"""You are horMoscope Ai - a brilliant, warm, and empowering women's health expert. You combine deep scientific knowledge with genuine compassion.

YOUR PERSONALITY:
- You're like a wise best friend who happens to have a PhD in women's health
- You make complex hormonal science feel accessible and empowering
- You're warm but not patronizing, smart but not pretentious
- You drop fascinating facts that make her go "wow, I never knew that!"
- You help her understand her body in ways no one ever has
- You celebrate her body's intelligence and natural rhythms
- You REMEMBER previous conversations and reference them naturally

SPEAKING WITH: {user_name}

HER PROFILE:{age_context}
- Typical cycle length: {cycle_info.get('cycle_length', 28)} days

CURRENT CYCLE STATUS: 
- Day {cycle_info.get('cycle_day', '?')} of her cycle
- Phase: {cycle_info.get('phase_info', 'Unknown')}
- {cycle_info.get('phase_description', '')}
- Days until next period: {cycle_info.get('days_until_period', '?')}
- Hormones: Estrogen {cycle_info.get('estrogen_level', 50)}% | Progesterone {cycle_info.get('progesterone_level', 30)}%
{recent_topics}

CONVERSATION MEMORY:
- You have access to our conversation history - USE IT!
- Reference things she's told you before ("Last time you mentioned..." or "Remember when you asked about...")
- Notice patterns ("I've noticed you often ask about energy during this phase...")
- Build on previous advice ("How did that nutrition tip work out?")

AGE-AWARE ADVICE:
- Tailor your advice to her life stage and age-related hormonal patterns
- Younger users: focus on cycle tracking basics, establishing patterns
- 30s: discuss fertility awareness, lifestyle impacts on hormones
- 40s+: be aware of perimenopause symptoms, cycle changes

DAILY CHECK-IN STYLE:
- If this is her first message today, warmly acknowledge where she is in her cycle
- Example: "Day 14 - you're in your power phase! How are you feeling today?"
- Tailor your energy to match her cycle phase

HOW TO RESPOND:
- Give her "aha moments" - insights that make her see her body differently
- Back up advice with fascinating science (but keep it digestible)
- Be specific to HER current cycle phase AND age with actionable tips
- Empower her - help her work WITH her hormones, not against them
- Cover: nutrition, exercise, sleep, productivity, relationships, emotions
- Occasionally drop mind-blowing facts about the female body
- Make her feel like her cycle is a superpower, not a burden{coach_image_context}"""

    # Use conversation_id to maintain memory within each conversation
    # If no conversation_id yet, create a temporary one that will be used for the new conversation
    temp_conversation_id = msg.conversation_id or str(uuid.uuid4())

    try:
        # Build the Anthropic message list: previous turns first, then the new message
        anthropic_messages = []

        # Load previous conversation history if this is an existing conversation
        # This ensures the AI remembers context even when the server restarts
        if msg.conversation_id:
            history = await db.chat_messages.find(
                {"conversation_id": msg.conversation_id, "user_id": current_user["id"]}
            ).sort("timestamp", 1).to_list(length=50)  # Last 50 messages

            for hist_msg in history:
                user_msg = hist_msg.get("user_message", "")
                ai_msg = hist_msg.get("ai_response", "")
                if user_msg:
                    anthropic_messages.append({"role": "user", "content": user_msg})
                if ai_msg:
                    anthropic_messages.append({"role": "assistant", "content": ai_msg})

            logger.info(f"Loaded {len(history)} messages for conversation {msg.conversation_id[:8]}...")

        # Build the current user message - with or without image
        if msg.image_base64:
            # Clean base64 string (remove data URL prefix if present, keep media type)
            image_data = msg.image_base64
            media_type = "image/jpeg"
            if "," in image_data:
                prefix, image_data = image_data.split(",", 1)
                media_match = re.match(r"data:(image/[a-zA-Z0-9.+-]+)", prefix)
                if media_match:
                    media_type = media_match.group(1)

            content = [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": image_data},
                },
                {"type": "text", "text": msg.message if msg.message else "What do you think? 📸"},
            ]
        else:
            content = msg.message

        anthropic_messages.append({"role": "user", "content": content})

        response = await call_anthropic(system_message, anthropic_messages, max_tokens=1024)
        
        # Handle conversation tracking
        conversation_id = msg.conversation_id
        if not conversation_id:
            # Use the temp_conversation_id we generated for session
            conversation_id = temp_conversation_id
            preview = "[📷 Photo] " + (msg.message[:30] if msg.message else "sent a photo") if msg.image_base64 else (msg.message[:50] + "..." if len(msg.message) > 50 else msg.message)
            conv_data = {
                "id": conversation_id,
                "user_id": current_user["id"],
                "is_boyfriend_mode": msg.is_boyfriend_mode,
                "preview": preview,
                "is_locked": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.conversations.insert_one(conv_data)
        else:
            # Update existing conversation
            await db.conversations.update_one(
                {"id": conversation_id},
                {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        
        # Save to database (don't store full image, just flag)
        chat_record = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "conversation_id": conversation_id,
            "user_message": msg.message if msg.message else "[Photo]",
            "ai_response": response,
            "is_boyfriend_mode": msg.is_boyfriend_mode,
            "has_image": bool(msg.image_base64),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.chat_messages.insert_one(chat_record)
        
        return ChatMessageResponse(
            id=chat_record["id"],
            user_message=msg.message if msg.message else "[Photo]",
            ai_response=response,
            is_boyfriend_mode=msg.is_boyfriend_mode,
            timestamp=chat_record["timestamp"],
            conversation_id=conversation_id,
            has_image=bool(msg.image_base64)
        )
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

@api_router.get("/chat/history")
async def get_chat_history(is_boyfriend_mode: bool = False, conversation_id: str = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if conversation_id:
        # When loading a specific conversation, just use the conversation_id
        query["conversation_id"] = conversation_id
    else:
        # When fetching general history, filter by mode
        query["is_boyfriend_mode"] = is_boyfriend_mode
    messages = await db.chat_messages.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).to_list(50)
    return messages[::-1]  # Return in chronological order

@api_router.get("/chat/conversations")
async def get_conversations(is_boyfriend_mode: bool = False, current_user: dict = Depends(get_current_user)):
    """Get list of conversations for sidebar"""
    conversations = await db.conversations.find(
        {"user_id": current_user["id"], "is_boyfriend_mode": is_boyfriend_mode},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(20)
    return conversations

@api_router.post("/chat/conversations/{conversation_id}/lock")
async def lock_conversation(conversation_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Lock a conversation with optional password"""
    body = await request.json() if request.headers.get('content-type') == 'application/json' else {}
    password = body.get('password', '')
    
    conv = await db.conversations.find_one({"id": conversation_id, "user_id": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Hash password if provided
    hashed_password = None
    if password:
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"is_locked": True, "lock_password": hashed_password}}
    )
    return {"is_locked": True}

@api_router.post("/chat/conversations/{conversation_id}/unlock")
async def unlock_conversation(conversation_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Unlock a conversation with password"""
    body = await request.json()
    password = body.get('password', '')
    remove_lock = body.get('remove_lock', False)
    
    conv = await db.conversations.find_one({"id": conversation_id, "user_id": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check password if one was set
    if conv.get('lock_password'):
        hashed = hashlib.sha256(password.encode()).hexdigest()
        if hashed != conv['lock_password']:
            raise HTTPException(status_code=403, detail="Incorrect password")
    
    if remove_lock:
        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": {"is_locked": False, "lock_password": None}}
        )
        return {"is_locked": False}
    
    return {"success": True}

@api_router.delete("/chat/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a conversation and its messages"""
    conv = await db.conversations.find_one({"id": conversation_id, "user_id": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Don't delete locked conversations
    if conv.get("is_locked"):
        raise HTTPException(status_code=400, detail="Cannot delete locked conversation")
    
    await db.conversations.delete_one({"id": conversation_id})
    await db.chat_messages.delete_many({"conversation_id": conversation_id})
    return {"message": "Conversation deleted"}

# ==================== INSIGHTS ====================

@api_router.get("/insights")
async def get_insights(current_user: dict = Depends(get_current_user)):
    last_period = current_user.get("last_period_date")
    cycle_length = current_user.get("cycle_length", 28)
    
    # Get cycle logs for the past 3 months
    three_months_ago = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    logs = await db.cycle_logs.find(
        {"user_id": current_user["id"], "date": {"$gte": three_months_ago}},
        {"_id": 0}
    ).to_list(100)
    
    # Generate hormone level estimates based on cycle day
    cycle_info = calculate_cycle_info(last_period, cycle_length) if last_period else {}
    cycle_day = cycle_info.get("cycle_day", 1)
    
    # Simplified hormone level estimates (relative levels)
    def get_hormone_levels(day, total_days):
        # Estrogen peaks around day 12-14
        estrogen_peak = total_days * 0.45
        estrogen = max(0, 100 - abs(day - estrogen_peak) * 5)
        
        # Progesterone rises after ovulation (day 14+)
        if day < total_days * 0.5:
            progesterone = 20
        else:
            progesterone = min(100, 20 + (day - total_days * 0.5) * 8)
        
        # LH peaks at ovulation
        lh_peak = total_days * 0.5
        lh = max(10, 100 - abs(day - lh_peak) * 15)
        
        # FSH is higher early in cycle
        fsh = max(20, 80 - day * 3)
        
        return {
            "estrogen": round(estrogen),
            "progesterone": round(progesterone),
            "lh": round(lh),
            "fsh": round(fsh)
        }
    
    # Generate chart data for full cycle
    hormone_chart = []
    for day in range(1, cycle_length + 1):
        levels = get_hormone_levels(day, cycle_length)
        hormone_chart.append({
            "day": day,
            **levels
        })
    
    # Count period days and symptoms
    period_days = len([l for l in logs if l.get("is_period")])
    symptom_counts = {}
    for log in logs:
        for symptom in log.get("symptoms", []):
            symptom_counts[symptom] = symptom_counts.get(symptom, 0) + 1
    
    return {
        "cycle_info": cycle_info,
        "hormone_chart": hormone_chart,
        "current_hormones": get_hormone_levels(cycle_day, cycle_length),
        "period_days_tracked": period_days,
        "common_symptoms": sorted(symptom_counts.items(), key=lambda x: -x[1])[:5],
        "cycle_length": cycle_length,
        "average_cycle_length": cycle_length  # Could calculate from logs
    }

# ==================== STRIPE SUBSCRIPTION ====================

import stripe

# Your Stripe Price ID for $4.99/month Premium
STRIPE_PRICE_ID = "price_1SszPCJ0aoaWJB3Rzm1vWVKA"

SUBSCRIPTION_PACKAGES = {
    "premium_monthly": 4.99
}

@api_router.post("/subscription/checkout")
async def create_checkout(data: SubscriptionPackage, current_user: dict = Depends(get_current_user)):
    if data.package_id not in SUBSCRIPTION_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    stripe.api_key = os.environ.get("STRIPE_API_KEY")
    
    success_url = f"{data.origin_url}/subscription?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/subscription"
    
    try:
        # Create Stripe Checkout Session with your Price ID
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price": STRIPE_PRICE_ID,
                "quantity": 1,
            }],
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": current_user["id"],
                "package_id": data.package_id
            }
        )
        
        # Create payment transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "session_id": session.id,
            "amount": SUBSCRIPTION_PACKAGES[data.package_id],
            "currency": "usd",
            "package_id": data.package_id,
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {"url": session.url, "session_id": session.id}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/subscription/status/{session_id}")
async def get_subscription_status(session_id: str, current_user: dict = Depends(get_current_user)):
    stripe.api_key = os.environ.get("STRIPE_API_KEY")
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        # Update transaction and user if paid
        if session.payment_status == "paid":
            # Check if already processed
            existing = await db.payment_transactions.find_one({
                "session_id": session_id,
                "payment_status": "paid"
            })
            
            if not existing:
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                # Save stripe_customer_id for subscription management
                update_data = {"is_premium": True}
                if session.customer:
                    update_data["stripe_customer_id"] = session.customer
                    logger.info(f"Saving stripe_customer_id {session.customer} for user {current_user['id']}")
                
                await db.users.update_one(
                    {"id": current_user["id"]},
                    {"$set": update_data}
                )
        
        return {
            "status": session.status,
            "payment_status": session.payment_status,
            "amount": session.amount_total / 100 if session.amount_total else 4.99
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe status error: {e}")
        raise HTTPException(status_code=500, detail="Error checking payment status")

@api_router.post("/webhook/stripe_legacy_unused")
async def stripe_webhook_legacy(request: Request):
    """Deprecated. The active webhook is registered earlier in this file at /api/webhook/stripe.
    Kept here as a no-op to prevent route collision while preserving git history."""
    return {"status": "deprecated"}

@api_router.post("/subscription/manage")
async def create_customer_portal(current_user: dict = Depends(get_current_user)):
    """Create a Stripe Customer Portal session for subscription management"""
    stripe.api_key = os.environ.get("STRIPE_API_KEY")
    
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    logger.info(f"Managing subscription for user {current_user['id']}, is_premium: {user.get('is_premium')}")
    
    customer_id = user.get("stripe_customer_id")
    logger.info(f"stripe_customer_id from user doc: {customer_id}")
    
    # If no customer ID, try to find from payment transactions
    if not customer_id:
        logger.info("No customer_id in user doc, checking payment transactions...")
        transaction = await db.payment_transactions.find_one({
            "user_id": current_user["id"],
            "payment_status": "paid"
        })
        logger.info(f"Found transaction: {transaction}")
        if transaction and transaction.get("session_id"):
            try:
                session = stripe.checkout.Session.retrieve(transaction["session_id"])
                customer_id = session.customer
                logger.info(f"Retrieved customer_id from session: {customer_id}")
                # Save for future use
                if customer_id:
                    await db.users.update_one(
                        {"id": current_user["id"]},
                        {"$set": {"stripe_customer_id": customer_id}}
                    )
            except Exception as e:
                logger.error(f"Error retrieving session: {e}")
    
    if not customer_id:
        logger.error(f"No customer_id found for user {current_user['id']}")
        raise HTTPException(status_code=400, detail="No active subscription found. Please contact support.")
    
    # Get frontend URL - check multiple sources
    frontend_url = os.environ.get("FRONTEND_URL")
    if not frontend_url:
        cors_origins = os.environ.get("CORS_ORIGINS", "")
        if cors_origins and cors_origins != "*":
            frontend_url = cors_origins.split(",")[0]
    
    # Fallback to the preview URL
    if not frontend_url or frontend_url == "*":
        frontend_url = "https://hormone-hub-1.preview.emergentagent.com"
    
    logger.info(f"Creating portal session with return_url: {frontend_url}/subscription")
    
    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=frontend_url + "/subscription"
        )
        return {"url": portal_session.url}
    except stripe.error.StripeError as e:
        logger.error(f"Stripe portal error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/subscription/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Directly cancel the user's subscription - keeps premium until billing period ends"""
    stripe.api_key = os.environ.get("STRIPE_API_KEY")
    
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get("is_premium"):
        raise HTTPException(status_code=400, detail="No active subscription to cancel")
    
    customer_id = user.get("stripe_customer_id")
    
    # If no customer ID, try to find from payment transactions
    if not customer_id:
        transaction = await db.payment_transactions.find_one({
            "user_id": current_user["id"],
            "payment_status": "paid"
        })
        if transaction and transaction.get("session_id"):
            try:
                session = stripe.checkout.Session.retrieve(transaction["session_id"])
                customer_id = session.customer
                # Save for future
                if customer_id:
                    await db.users.update_one(
                        {"id": current_user["id"]},
                        {"$set": {"stripe_customer_id": customer_id}}
                    )
            except Exception as e:
                logger.error(f"Error retrieving session: {e}")
    
    cancel_date = None
    
    if customer_id:
        try:
            # Find and cancel all active subscriptions for this customer
            subscriptions = stripe.Subscription.list(customer=customer_id, status='active')
            
            for sub in subscriptions.data:
                # Cancel at period end (user keeps access until end of billing period)
                updated_sub = stripe.Subscription.modify(
                    sub.id,
                    cancel_at_period_end=True
                )
                # Get the date when premium ends
                cancel_date = datetime.fromtimestamp(updated_sub.current_period_end, tz=timezone.utc).isoformat()
                logger.info(f"Cancelled subscription {sub.id} for customer {customer_id}, ends at {cancel_date}")
                
        except stripe.error.StripeError as e:
            logger.error(f"Stripe cancel error: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to cancel subscription: {str(e)}")
    
    # Mark as cancelled but DO NOT remove premium - they keep it until period ends
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "subscription_cancelled": True, 
            "cancellation_date": datetime.now(timezone.utc).isoformat(),
            "premium_ends_at": cancel_date
        }}
    )
    
    if cancel_date:
        from datetime import datetime as dt
        end_date = dt.fromisoformat(cancel_date.replace('Z', '+00:00'))
        formatted_date = end_date.strftime("%B %d, %Y")
        return {
            "success": True, 
            "message": f"Subscription cancelled. You'll keep premium access until {formatted_date}."
        }
    else:
        return {
            "success": True, 
            "message": "Subscription cancelled. You'll keep premium access until the end of your billing period."
        }


# ==================== PUSH NOTIFICATIONS ====================

class PushSubscription(BaseModel):
    endpoint: str
    keys: Dict[str, str]
    expirationTime: Optional[int] = None

@api_router.post("/push/subscribe")
async def subscribe_to_push(subscription: PushSubscription, current_user: dict = Depends(get_current_user)):
    """Save push subscription for a user"""
    try:
        # Store subscription in database
        await db.push_subscriptions.update_one(
            {"user_id": current_user["id"], "endpoint": subscription.endpoint},
            {"$set": {
                "user_id": current_user["id"],
                "endpoint": subscription.endpoint,
                "keys": subscription.keys,
                "expiration_time": subscription.expirationTime,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "active": True
            }},
            upsert=True
        )
        
        # Also enable notifications for this user
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"notifications_enabled": True, "push_subscribed": True}}
        )
        
        logger.info(f"Push subscription saved for user {current_user['id']}")
        return {"success": True, "message": "Subscribed to push notifications"}
    except Exception as e:
        logger.error(f"Error saving push subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to save subscription")

@api_router.post("/push/unsubscribe")
async def unsubscribe_from_push(data: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Remove push subscription for a user"""
    try:
        endpoint = data.get("endpoint")
        if endpoint:
            await db.push_subscriptions.delete_one({
                "user_id": current_user["id"],
                "endpoint": endpoint
            })
        else:
            # Remove all subscriptions for this user
            await db.push_subscriptions.delete_many({"user_id": current_user["id"]})
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"push_subscribed": False}}
        )
        
        logger.info(f"Push subscription removed for user {current_user['id']}")
        return {"success": True, "message": "Unsubscribed from push notifications"}
    except Exception as e:
        logger.error(f"Error removing push subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to unsubscribe")

@api_router.post("/push/send-test")
async def send_test_notification(current_user: dict = Depends(get_current_user)):
    """Send a test push notification to the current user"""
    subscriptions = await db.push_subscriptions.find({"user_id": current_user["id"], "active": True}).to_list(100)
    
    if not subscriptions:
        raise HTTPException(status_code=404, detail="No push subscriptions found. Please enable notifications first.")
    
    # Get user's cycle info for personalized message
    user = await db.users.find_one({"id": current_user["id"]})
    user_name = user.get("name", "Beautiful")
    cycle_info = calculate_cycle_info(user.get("last_period_date"), user.get("cycle_length", 28))
    phase = cycle_info.get("phase", "follicular")
    cycle_day = cycle_info.get("cycle_day", 1)
    
    # Phase-based messages
    messages = {
        "menstrual": f"Hey {user_name}, day {cycle_day} - be gentle with yourself today. Your body is renewing.",
        "follicular": f"Good morning {user_name}! Day {cycle_day} - your energy is rising. Great day to start something new!",
        "ovulatory": f"Hey gorgeous {user_name}! Day {cycle_day} - you're glowing! Your communication skills are at their peak.",
        "luteal": f"Hi {user_name}, day {cycle_day} - honor your need for rest. It's okay to slow down."
    }
    
    notification_data = {
        "title": "Hormone Health Coach",
        "body": messages.get(phase, f"Hey {user_name}! Check in with your cycle today."),
        "icon": "/logo192.png",
        "url": "/"
    }
    
    sent_count = 0
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"]
                },
                data=json.dumps(notification_data),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_EMAIL}
            )
            sent_count += 1
            logger.info(f"Push notification sent to user {current_user['id']}")
        except WebPushException as e:
            logger.error(f"WebPush error: {e}")
            if e.response and e.response.status_code == 410:
                # Subscription expired, remove it
                await db.push_subscriptions.delete_one({"_id": sub["_id"]})
    
    return {"success": True, "message": f"Test notification sent to {sent_count} device(s)"}

@api_router.post("/push/send-to-all")
async def send_notifications_to_all():
    """Send daily notifications to all subscribed users (called by cron job)"""
    # Get all users with notifications enabled
    users = await db.users.find({"notifications_enabled": True, "push_subscribed": True}).to_list(None)
    
    sent_count = 0
    failed_count = 0
    
    for user in users:
        subscriptions = await db.push_subscriptions.find({"user_id": user["id"], "active": True}).to_list(10)
        if not subscriptions:
            continue
        
        user_name = user.get("name", "Beautiful")
        cycle_info = calculate_cycle_info(user.get("last_period_date"), user.get("cycle_length", 28))
        phase = cycle_info.get("phase", "follicular")
        cycle_day = cycle_info.get("cycle_day", 1)
        is_premium = user.get("is_premium", False)
        boyfriend_name = user.get("boyfriend_name", "Johnny")
        
        # Different messages for premium vs free users
        if is_premium:
            messages = {
                "menstrual": f"Hey {user_name}, it's {boyfriend_name}. Day {cycle_day} - I know it can be tough. I'm here for you.",
                "follicular": f"{user_name}! {boyfriend_name} here. Day {cycle_day} - your energy is amazing today!",
                "ovulatory": f"Wow {user_name}... {boyfriend_name} here. Day {cycle_day} and you're absolutely glowing!",
                "luteal": f"Hey {user_name}, it's {boyfriend_name}. Day {cycle_day} - remember to be gentle with yourself."
            }
            title = boyfriend_name
        else:
            messages = {
                "menstrual": f"Hey {user_name}, day {cycle_day} - be gentle with yourself today.",
                "follicular": f"Good morning {user_name}! Day {cycle_day} - great day to start something new!",
                "ovulatory": f"Hey {user_name}! Day {cycle_day} - you're at your peak. Shine bright!",
                "luteal": f"Hi {user_name}, day {cycle_day} - honor your need for rest today."
            }
            title = "Hormone Health Coach"
        
        notification_data = {
            "title": title,
            "body": messages.get(phase, f"Hey {user_name}! Check in with your cycle today."),
            "icon": "/logo192.png",
            "url": "/boyfriend" if is_premium else "/"
        }
        
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": sub["keys"]
                    },
                    data=json.dumps(notification_data),
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_EMAIL}
                )
                sent_count += 1
            except WebPushException as e:
                failed_count += 1
                if e.response and e.response.status_code == 410:
                    await db.push_subscriptions.delete_one({"_id": sub["_id"]})
    
    logger.info(f"Daily notifications sent: {sent_count} success, {failed_count} failed")
    return {"success": True, "sent": sent_count, "failed": failed_count}

@api_router.post("/push/send-to-user/{email}")
async def send_notification_to_user(email: str):
    """Send a push notification to a specific user by email"""
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscriptions = await db.push_subscriptions.find({"user_id": user["id"], "active": True}).to_list(10)
    if not subscriptions:
        raise HTTPException(status_code=404, detail="User has no push subscriptions")
    
    user_name = user.get("name", "Beautiful")
    cycle_info = calculate_cycle_info(user.get("last_period_date"), user.get("cycle_length", 28))
    phase = cycle_info.get("phase", "follicular")
    cycle_day = cycle_info.get("cycle_day", 1)
    is_premium = user.get("is_premium", False)
    boyfriend_name = user.get("boyfriend_name", "Johnny")
    
    if is_premium:
        body = f"Hey {user_name}, it's {boyfriend_name}. Day {cycle_day} of your cycle - thinking of you!"
        title = boyfriend_name
    else:
        body = f"Hey {user_name}! Day {cycle_day} - check in with how your body is feeling today."
        title = "Hormone Health Coach"
    
    notification_data = {
        "title": title,
        "body": body,
        "icon": "/logo192.png",
        "url": "/"
    }
    
    sent = 0
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"]
                },
                data=json.dumps(notification_data),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_EMAIL}
            )
            sent += 1
        except WebPushException as e:
            logger.error(f"Failed to send to {email}: {e}")
    
    return {"success": True, "message": f"Notification sent to {sent} device(s) for {email}"}


# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "horMoscope Ai API - Cosmic Wellness Tracking"}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
