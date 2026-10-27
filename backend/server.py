from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Body, UploadFile, File
from fastapi.responses import HTMLResponse
import html as html_lib
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
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

# MongoDB connection (strip any whitespace/newlines from copy-paste)
mongo_url = "".join(os.environ['MONGO_URL'].split())
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'hormoscope')]

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


async def call_anthropic(system_message: str, messages: list, max_tokens: int = 1024, return_usage: bool = False):
    """Send a message list to Anthropic and return the concatenated text reply.

    With return_usage=True, returns (text, {"input_tokens": n,
    "output_tokens": n}) using the counts Anthropic itself reports."""
    client = get_anthropic_client()
    response = await client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        system=system_message,
        messages=messages,
    )
    text = "".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    )
    if return_usage:
        usage = getattr(response, "usage", None)
        return text, {
            "input_tokens": int(getattr(usage, "input_tokens", 0) or 0),
            "output_tokens": int(getattr(usage, "output_tokens", 0) or 0),
        }
    return text

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

PASSWORD_MIN_LENGTH = 8

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    # Required at sign-up: the person confirms she is 18+ and agrees to the
    # Terms, Privacy Policy and the processing of her cycle/health data.
    is_adult: bool = False
    accepted_terms: bool = False

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Cycle situations that make fertile-window / ovulation predictions
# meaningless, so they are switched off for these users.
CYCLE_STATUSES = {"regular", "unsure", "hormonal_birth_control", "pregnant", "postpartum", "menopause", "no_periods"}
NO_FERTILITY_STATUSES = {"hormonal_birth_control", "pregnant", "postpartum", "menopause", "no_periods"}
PARTNER_VISIBILITY_KEYS = ("phase", "mood_energy", "period_dates", "fertile_window", "wishlist", "share_journal")
# share_journal (v49, Angelita, Oct 26, 2026): her journal entries are
# shared with her linked in-app partner ONLY when she turns this on.
# Default False for everyone: new users, existing users, existing
# relationships. It never applies to view links, and entries she
# marked intimate are never served to a partner either way.
DEFAULT_PARTNER_VISIBILITY = {"phase": True, "mood_energy": True, "period_dates": True, "fertile_window": False, "wishlist": True, "share_journal": False}
BOUTIQUE_VISIBILITY_VALUES = ("private", "partner", "public")


class UserOnboarding(BaseModel):
    name: str
    birthday: Optional[str] = None  # optional now; set from Profile
    cycle_length: int = 28
    # None = she doesn't remember. We never invent a date.
    last_period_date: Optional[str] = None
    cycle_status: str = "regular"
    # Feature B (v46): she no longer has periods. Durable flag; her days
    # are built from what she logs, never from cycle math.
    no_periods: bool = False
    partner_choice: Optional[str] = None  # invite_partner | sync_girlfriend | later
    partner_visibility: Optional[Dict[str, bool]] = None
    notifications_enabled: bool = True
    notification_time: str = "09:00"
    # v49: the period and ovulation alerts are separate choices on the
    # onboarding reminders step. Optional and additive: older clients
    # omit it and keep the stored server preferences untouched.
    notification_preferences: Optional[Dict[str, bool]] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    birthday: Optional[str] = None
    age: Optional[int] = None
    cycle_length: int = 28
    period_length: int = 5
    last_period_date: Optional[str] = None
    profile_photo: Optional[str] = None
    is_premium: bool = False
    companion_entitled: bool = False
    onboarding_complete: bool = False
    notifications_enabled: bool = True
    notification_time: str = "09:00"
    notification_preferences: Dict[str, bool] = {}
    cycle_status: str = "regular"
    no_periods: bool = False
    fertility_predictions_enabled: bool = True
    partner_visibility: Dict[str, bool] = {}
    boutique_visibility: str = "private"
    conditions: List[str] = []
    email_verified: bool = False
    created_at: Optional[str] = None

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
    conversation_id: Optional[str] = None
    image_base64: Optional[str] = None  # Base64 encoded image for vision

class ChatMessageResponse(BaseModel):
    id: str
    user_message: str
    ai_response: str
    timestamp: str
    conversation_id: Optional[str] = None
    has_image: bool = False

class SubscriptionPackage(BaseModel):
    package_id: str
    origin_url: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    notification_preferences: Optional[Dict[str, bool]] = None
    profile_photo: Optional[str] = None
    birthday: Optional[str] = None  # "" clears it
    cycle_status: Optional[str] = None
    no_periods: Optional[bool] = None
    partner_visibility: Optional[Dict[str, bool]] = None
    boutique_visibility: Optional[str] = None  # private | partner | public
    notifications_enabled: Optional[bool] = None
    notification_time: Optional[str] = None
    conditions: Optional[List[str]] = None  # e.g. PMDD, PCOS, endometriosis

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


# Recipes and vitamins matched to each daily nutrition entry above
# (Angelita, Oct 20, 2026): every daily food list gets one easy recipe
# built from those exact foods, plus the vitamins that matter that day.
# Keyed by the entry's tip text so both fresh and cached daily content
# can find its match.
NUTRITION_EXTRAS = {
    "Focus on iron-rich foods to replenish what's lost.": {
        "recipe": {"title": "Skillet Beef, Lentils and Greens", "minutes": 25,
                   "ingredients": ["Red meat, sliced thin or ground", "Cooked lentils", "Dark leafy greens", "Pumpkin seeds", "Garlic and olive oil"],
                   "steps": ["Brown the meat in olive oil with the garlic.", "Stir in the lentils and warm them through.", "Fold in the greens until just wilted.", "Shower pumpkin seeds over the top and serve hot."]},
        "vitamins": [{"name": "Iron", "why": "Replenishes what your period takes from you."},
                     {"name": "Vitamin C", "why": "Helps your body absorb that iron."},
                     {"name": "Vitamin B12", "why": "Supports your energy while you bleed."}]},
    "Warm, nourishing foods support your body during menstruation.": {
        "recipe": {"title": "Ginger Root Vegetable Soup", "minutes": 30,
                   "ingredients": ["Bone broth", "Root vegetables (carrots, sweet potato, parsnip)", "Fresh ginger", "Dark chocolate, for after"],
                   "steps": ["Chop the root vegetables into chunks.", "Simmer them in the bone broth with grated ginger until soft.", "Season, ladle into a warm bowl, and sip slowly.", "A square of dark chocolate after, just because."]},
        "vitamins": [{"name": "Vitamin A", "why": "Root vegetables support your immune system."},
                     {"name": "Vitamin C", "why": "Helps you fight off the run-down feeling."},
                     {"name": "Iron", "why": "Bone broth and roots help rebuild."}]},
    "Anti-inflammatory foods help reduce cramps and discomfort.": {
        "recipe": {"title": "Turmeric Salmon with Walnut Greens", "minutes": 20,
                   "ingredients": ["Salmon fillet", "Turmeric", "Olive oil", "Walnuts", "A handful of greens"],
                   "steps": ["Rub the salmon with turmeric and a pinch of salt.", "Sear it in olive oil until just cooked through.", "Rest it over the greens so they soften in the warmth.", "Scatter crushed walnuts and a drizzle of olive oil over everything."]},
        "vitamins": [{"name": "Omega-3", "why": "Naturally eases inflammation and cramps."},
                     {"name": "Vitamin D", "why": "Salmon is one of the best sources there is."},
                     {"name": "Vitamin E", "why": "Walnuts and olive oil protect your cells."}]},
    "Stay hydrated to help with bloating and fatigue.": {
        "recipe": {"title": "Watermelon Cucumber Cooler", "minutes": 10,
                   "ingredients": ["Watermelon", "Cucumber", "Coconut water", "Herbal tea, for later", "Mint or lime if you have it"],
                   "steps": ["Blend the watermelon with the coconut water.", "Cut the cucumber into thin ribbons and stir them in.", "Chill it well and sip it through the day.", "Follow with warm herbal tea when you want something cozy."]},
        "vitamins": [{"name": "Vitamin C", "why": "Watermelon brings it along with all that water."},
                     {"name": "Potassium", "why": "Helps with bloating and water balance."},
                     {"name": "Vitamin A", "why": "Supports your skin and immune system."}]},
    "Vitamin C helps with iron absorption during your period.": {
        "recipe": {"title": "Sweet Pepper and Broccoli Stir-Fry with Orange", "minutes": 15,
                   "ingredients": ["Bell peppers", "Broccoli", "One orange", "Strawberries, for after", "Garlic and olive oil"],
                   "steps": ["Sizzle the garlic in olive oil.", "Add the broccoli and peppers and cook until bright and tender-crisp.", "Squeeze the orange over the pan and toss everything in its juice.", "Strawberries for dessert."]},
        "vitamins": [{"name": "Vitamin C", "why": "The star today: it unlocks iron from your food."},
                     {"name": "Vitamin K", "why": "Broccoli supports healthy blood and bones."},
                     {"name": "Folate", "why": "Helps your body build new cells."}]},
    "Omega-3s can help reduce menstrual pain naturally.": {
        "recipe": {"title": "Sardine Toasts with Seed Crunch", "minutes": 10,
                   "ingredients": ["Sardines", "Good toast", "Chia seeds", "Ground flaxseed", "Hemp seeds", "A lemon wedge"],
                   "steps": ["Mash the sardines with lemon juice and a pinch of salt.", "Pile them onto warm toast.", "Sprinkle the chia, flaxseed, and hemp seeds over the top.", "Eat right away, while the toast is still crisp."]},
        "vitamins": [{"name": "Omega-3", "why": "Can take the edge off period pain."},
                     {"name": "Vitamin D", "why": "Sardines carry it in every bite."},
                     {"name": "Calcium", "why": "Those tiny sardine bones are full of it."}]},
    "Zinc supports hormone balance during menstruation.": {
        "recipe": {"title": "Beef and Chickpea Skillet with Cashews", "minutes": 20,
                   "ingredients": ["Beef strips", "Chickpeas", "Cashews", "Smoked paprika", "Oysters on the side, if they are your thing"],
                   "steps": ["Sear the beef until browned at the edges.", "Add the chickpeas and paprika and crisp them in the same pan.", "Fold in the cashews for the last minute.", "Serve hot, with lemon if you like it bright."]},
        "vitamins": [{"name": "Zinc", "why": "Supports hormone balance during your period."},
                     {"name": "Iron", "why": "Beef and chickpeas both bring it."},
                     {"name": "Vitamin B6", "why": "Helps with mood and energy."}]},
    "Light, fresh foods support your rising energy.": {
        "recipe": {"title": "Citrus Sprout Salad with Chicken", "minutes": 15,
                   "ingredients": ["Salad greens", "Sprouts", "Citrus fruit", "Cooked chicken or turkey", "Olive oil"],
                   "steps": ["Layer the greens and sprouts in a wide bowl.", "Add the citrus in segments, saving the juice.", "Top with the sliced protein.", "Dress with the citrus juice and olive oil."]},
        "vitamins": [{"name": "Vitamin C", "why": "Citrus keeps your immune system strong as energy rises."},
                     {"name": "Folate", "why": "Greens and sprouts help build healthy cells."},
                     {"name": "Vitamin K", "why": "Supports blood and bone health."}]},
    "Fermented foods support estrogen metabolism.": {
        "recipe": {"title": "Kimchi Yogurt Grain Bowl", "minutes": 15,
                   "ingredients": ["Warm rice or grains", "Kimchi", "Sauerkraut", "Greek yogurt", "Kombucha, to drink"],
                   "steps": ["Spoon the warm grains into a bowl.", "Pile the kimchi and sauerkraut over one side.", "Add a generous dollop of yogurt.", "Sip kombucha alongside."]},
        "vitamins": [{"name": "Probiotics", "why": "A happy gut helps your body handle rising estrogen."},
                     {"name": "Vitamin B12", "why": "Yogurt supports energy and nerves."},
                     {"name": "Vitamin K", "why": "Fermented foods are a quiet source."}]},
    "Protein supports the follicle development happening now.": {
        "recipe": {"title": "Golden Tofu and Egg Scramble", "minutes": 12,
                   "ingredients": ["Eggs", "Tofu", "Greek yogurt", "Chives or herbs", "Chicken breast on the side, if you want more"],
                   "steps": ["Crumble the tofu into a warm pan and let it take a little color.", "Pour the beaten eggs over and scramble softly.", "Take the pan off the heat and swirl in the yogurt.", "Finish with herbs and eat warm."]},
        "vitamins": [{"name": "Choline", "why": "Eggs support the follicle developing now."},
                     {"name": "Vitamin B12", "why": "Fuels your rising energy."},
                     {"name": "Vitamin D", "why": "In the yolks, for hormone health."}]},
    "B vitamins boost the energy surge you're feeling.": {
        "recipe": {"title": "Avocado Grain Bowl with Seeds", "minutes": 15,
                   "ingredients": ["Cooked whole grains", "Avocado", "Legumes (beans or lentils)", "Sunflower seeds", "Lemon"],
                   "steps": ["Warm the grains and legumes together.", "Spoon them into a bowl.", "Lay the avocado over the top in slices.", "Scatter sunflower seeds and finish with lemon and salt."]},
        "vitamins": [{"name": "B vitamins", "why": "Whole grains and legumes fuel the energy surge."},
                     {"name": "Folate", "why": "Legumes help your body build and repair."},
                     {"name": "Vitamin E", "why": "Avocado and seeds protect your cells."}]},
    "Phytoestrogens support healthy estrogen levels.": {
        "recipe": {"title": "Berry Soy Smoothie with Flax and Sesame", "minutes": 5,
                   "ingredients": ["Soy milk or silken tofu", "Berries", "Ground flaxseeds", "Sesame seeds or tahini", "Honey if you like it sweeter"],
                   "steps": ["Put everything in the blender.", "Blend until completely smooth.", "Pour it cold and drink it slowly.", "That is the whole recipe. Enjoy the easy one."]},
        "vitamins": [{"name": "Vitamin C", "why": "Berries support your skin and immune system."},
                     {"name": "Vitamin E", "why": "Sesame brings a gentle dose."},
                     {"name": "Calcium", "why": "Soy milk is usually fortified with it."}]},
    "Vitamin E supports egg health during this phase.": {
        "recipe": {"title": "Sweet Potato and Spinach Hash with Almonds", "minutes": 20,
                   "ingredients": ["Sweet potato", "Spinach", "Almonds", "Sunflower seeds", "An egg on top, if you like"],
                   "steps": ["Dice the sweet potato small and crisp it in a pan.", "Wilt the spinach in at the end.", "Top with almonds and sunflower seeds.", "A fried egg over everything never hurts."]},
        "vitamins": [{"name": "Vitamin E", "why": "Supports egg health in this phase."},
                     {"name": "Vitamin A", "why": "Sweet potato is loaded with it."},
                     {"name": "Iron", "why": "Spinach quietly adds some."}]},
    "Fresh vegetables support your body's natural detox.": {
        "recipe": {"title": "Roasted Beet, Carrot and Asparagus Plate", "minutes": 25,
                   "ingredients": ["Beets", "Carrots", "Asparagus", "Artichoke hearts", "Olive oil and lemon"],
                   "steps": ["Roast the beets and carrots until sweet and tender.", "Add the asparagus for the last ten minutes.", "Plate with the artichoke hearts.", "Finish with olive oil, lemon, and salt."]},
        "vitamins": [{"name": "Folate", "why": "Beets and asparagus are full of it."},
                     {"name": "Vitamin A", "why": "Carrots support your eyes and skin."},
                     {"name": "Vitamin K", "why": "Asparagus helps blood and bones."}]},
    "Raw vegetables and fiber support peak metabolism.": {
        "recipe": {"title": "Quinoa Crunch Bowl with Light Fish", "minutes": 20,
                   "ingredients": ["Quinoa", "Raw veggies (peppers, cucumber, carrot)", "Berries", "Light fish", "Lemon and olive oil"],
                   "steps": ["Cook the quinoa and let it cool a little.", "Sear the fish until just flaky.", "Chop the raw veggies into bite-size crunch.", "Bowl it all together, berries on top, lemon over everything."]},
        "vitamins": [{"name": "Vitamin C", "why": "Raw veggies keep all of theirs."},
                     {"name": "Folate", "why": "Supports the cell activity of this peak phase."},
                     {"name": "Vitamin B12", "why": "The fish brings energy support."}]},
    "Antioxidant-rich foods support this fertile phase.": {
        "recipe": {"title": "Spinach and Blueberry Salad with Pomegranate", "minutes": 10,
                   "ingredients": ["Spinach", "Blueberries", "Pomegranate seeds", "Walnuts if you have them", "Green tea, to drink"],
                   "steps": ["Lay the spinach in a wide bowl.", "Scatter the blueberries and pomegranate seeds over it.", "Add walnuts for crunch if you have them.", "Brew the green tea and eat slowly."]},
        "vitamins": [{"name": "Antioxidants", "why": "Berries and pomegranate protect your cells at your peak."},
                     {"name": "Vitamin C", "why": "Supports your immune system and skin."},
                     {"name": "Vitamin K", "why": "Spinach carries it quietly."}]},
    "Glutathione-rich foods support egg quality.": {
        "recipe": {"title": "Garlic Asparagus with Avocado and Spinach", "minutes": 15,
                   "ingredients": ["Asparagus", "Garlic", "Spinach", "Avocado", "An egg, if you like"],
                   "steps": ["Sizzle the garlic in olive oil.", "Add the asparagus and cook until bright green.", "Wilt the spinach in the same pan.", "Serve with avocado slices over the top."]},
        "vitamins": [{"name": "Folate", "why": "Asparagus is one of the richest sources."},
                     {"name": "Vitamin C", "why": "Supports egg quality alongside the greens."},
                     {"name": "Vitamin E", "why": "Avocado protects your cells."}]},
    "Light proteins keep energy high without weighing you down.": {
        "recipe": {"title": "Lemon Shrimp with Tempeh Crumbles", "minutes": 15,
                   "ingredients": ["Shrimp", "Tempeh", "Lemon", "Garlic", "Greens to serve"],
                   "steps": ["Crumble and crisp the tempeh in a hot pan.", "Add the shrimp and garlic and cook until the shrimp turn pink.", "Squeeze lemon over everything.", "Serve over greens, light and bright."]},
        "vitamins": [{"name": "Vitamin B12", "why": "Shrimp supports energy at your peak."},
                     {"name": "Selenium", "why": "Supports thyroid and egg health."},
                     {"name": "Vitamin D", "why": "A little from the shrimp, a lot of good from it."}]},
    "Zinc is crucial for ovulation and fertility.": {
        "recipe": {"title": "Lamb and Chickpea Plate with Pumpkin Seeds", "minutes": 25,
                   "ingredients": ["Lamb chops or ground lamb", "Chickpeas", "Pumpkin seeds", "Cocoa, for a hot drink after"],
                   "steps": ["Sear the lamb until browned and rested.", "Crisp the chickpeas in the same pan juices.", "Scatter pumpkin seeds over the plate.", "A small hot cocoa after, rich and dark."]},
        "vitamins": [{"name": "Zinc", "why": "Crucial for ovulation, and lamb brings it."},
                     {"name": "Iron", "why": "Supports the blood work of this phase."},
                     {"name": "Vitamin B12", "why": "For energy and healthy cells."}]},
    "Stay cool with hydrating foods during peak fertility.": {
        "recipe": {"title": "Watermelon, Cucumber and Celery Salad", "minutes": 10,
                   "ingredients": ["Watermelon", "Cucumber", "Celery", "Coconut water, to drink", "Lime and mint if you have them"],
                   "steps": ["Chop the watermelon, cucumber, and celery into chunks.", "Toss with lime juice and mint.", "Chill before eating if you can wait.", "Sip coconut water alongside, cold."]},
        "vitamins": [{"name": "Vitamin C", "why": "Light and bright, like this phase."},
                     {"name": "Vitamin A", "why": "Watermelon supports skin and immunity."},
                     {"name": "Potassium", "why": "Keeps fluids balanced while you hydrate."}]},
    "Folate supports cellular health during ovulation.": {
        "recipe": {"title": "Warm Lentil and Greens Bowl with Citrus", "minutes": 20,
                   "ingredients": ["Lentils", "Leafy greens", "Citrus fruit", "Olive oil", "Fortified cereal makes an easy breakfast the same day"],
                   "steps": ["Simmer the lentils until tender.", "Wilt the greens into the warm lentils.", "Segment the citrus over the bowl and squeeze in its juice.", "Finish with olive oil and salt."]},
        "vitamins": [{"name": "Folate", "why": "Supports cellular health during ovulation."},
                     {"name": "Iron", "why": "Lentils are a gentle, steady source."},
                     {"name": "Vitamin C", "why": "The citrus helps the iron absorb."}]},
    "Complex carbs help stabilize mood and reduce PMS.": {
        "recipe": {"title": "Savory Sweet Potato Oatmeal", "minutes": 15,
                   "ingredients": ["Oats", "Sweet potato, grated or finely diced", "Cooked brown rice, stirred in if you have it", "Butter or olive oil", "An egg on top"],
                   "steps": ["Simmer the oats with the sweet potato until thick and soft.", "Stir in the brown rice to warm it through.", "Add butter or olive oil and salt.", "Top with a soft egg and eat it warm and slow."]},
        "vitamins": [{"name": "Vitamin B6", "why": "Helps steady mood in the luteal days."},
                     {"name": "Vitamin A", "why": "Sweet potato supports your immune system."},
                     {"name": "Magnesium", "why": "Whole grains bring a calming dose."}]},
    "Magnesium helps with water retention and mood swings.": {
        "recipe": {"title": "Banana Avocado Chocolate Mousse", "minutes": 10,
                   "ingredients": ["Banana", "Avocado", "Dark chocolate", "Almonds, crushed"],
                   "steps": ["Melt the dark chocolate gently.", "Blend it with the banana and avocado until silky.", "Chill for twenty minutes if you can wait.", "Crushed almonds over the top."]},
        "vitamins": [{"name": "Magnesium", "why": "Dark chocolate and avocado ease water retention and mood swings."},
                     {"name": "Potassium", "why": "Banana helps with bloating."},
                     {"name": "Vitamin E", "why": "Almonds protect and nourish."}]},
    "Calcium can reduce PMS symptoms by up to 50%.": {
        "recipe": {"title": "Creamy Kale with Yogurt and Sardine Toasts", "minutes": 15,
                   "ingredients": ["Kale", "Yogurt", "Sardines", "Toast", "Fortified milk, as a drink", "Garlic"],
                   "steps": ["Wilt the kale with garlic until tender.", "Take it off the heat and stir in the yogurt until creamy.", "Mash the sardines onto toast with lemon or salt.", "A glass of fortified milk alongside."]},
        "vitamins": [{"name": "Calcium", "why": "Can take a real bite out of PMS symptoms."},
                     {"name": "Vitamin D", "why": "Sardines and fortified milk team up."},
                     {"name": "Vitamin K", "why": "Kale is full of it."}]},
    "Vitamin B6 helps with mood and reduces bloating.": {
        "recipe": {"title": "Chicken and Potato Tray Bake with Pistachios", "minutes": 30,
                   "ingredients": ["Chicken", "Potatoes", "Pistachios", "A banana, for after", "Olive oil and herbs"],
                   "steps": ["Roast the chicken and potatoes together until golden.", "Rest them a few minutes.", "Scatter pistachios over the top.", "Banana for dessert, simple and sweet."]},
        "vitamins": [{"name": "Vitamin B6", "why": "Chicken and potatoes both carry it, for mood and bloating."},
                     {"name": "Potassium", "why": "Helps your body let go of extra water."},
                     {"name": "Niacin", "why": "Supports energy when the luteal slump hits."}]},
    "Fiber helps your body process excess hormones.": {
        "recipe": {"title": "Broccoli Lentil Soup with Chia and Apple", "minutes": 25,
                   "ingredients": ["Lentils", "Broccoli", "Chia seeds", "An apple", "Garlic and olive oil"],
                   "steps": ["Simmer the lentils with garlic until soft.", "Add the broccoli and cook until tender.", "Stir in the chia seeds and let the soup thicken.", "Apple slices on the side, or diced in for sweetness."]},
        "vitamins": [{"name": "Folate", "why": "Lentils and broccoli help your body process and clear."},
                     {"name": "Vitamin C", "why": "Broccoli brings plenty."},
                     {"name": "Vitamin K", "why": "Supports blood and bone health."}]},
    "Healthy fats support progesterone production.": {
        "recipe": {"title": "Salmon and Egg Bowl with Walnuts", "minutes": 15,
                   "ingredients": ["Salmon", "Eggs, yolks in", "Olive oil", "Walnuts", "Greens to serve"],
                   "steps": ["Sear the salmon in olive oil.", "Soft-scramble the eggs in the same pan warmth.", "Serve both over greens.", "Walnuts scattered over, and a last drizzle of olive oil."]},
        "vitamins": [{"name": "Omega-3", "why": "Healthy fats support progesterone production now."},
                     {"name": "Vitamin D", "why": "Salmon and yolks, a luteal dream team."},
                     {"name": "Vitamin B12", "why": "Steady energy for the wind-down."}]},
    "Tryptophan-rich foods boost serotonin for better mood.": {
        "recipe": {"title": "Turkey and Cheese Melts with Pumpkin Seeds", "minutes": 12,
                   "ingredients": ["Turkey slices", "Cheese", "Pumpkin seeds", "Oatcakes or toast", "A little butter"],
                   "steps": ["Layer the turkey and cheese on the oatcakes or toast.", "Grill until the cheese bubbles.", "Scatter pumpkin seeds over the melts.", "Eat warm, preferably somewhere comfortable."]},
        "vitamins": [{"name": "Tryptophan", "why": "Turkey helps your body make serotonin, for mood and sleep."},
                     {"name": "Vitamin B6", "why": "Helps that serotonin pathway along."},
                     {"name": "Calcium", "why": "The cheese brings it."}]},
}


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
        extras = NUTRITION_EXTRAS.get(cached["nutrition_tip"], {})
        return {
            "affirmation": cached["affirmation"],
            "nutrition_tip": cached["nutrition_tip"],
            "foods_to_eat": cached["foods_to_eat"],
            "foods_to_avoid": cached["foods_to_avoid"],
            "wellness_tip": cached["wellness_tip"],
            "mood_prediction": cached["mood_prediction"],
            "recipe": cached.get("recipe") or extras.get("recipe"),
            "vitamins": cached.get("vitamins") or extras.get("vitamins")
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
    
    chosen_nutrition = phase_nutrition[nutrition_index % len(phase_nutrition)]
    nutrition_extras = NUTRITION_EXTRAS.get(chosen_nutrition["tip"], {})

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
        "wellness_tip": phase_wellness[wellness_index % len(phase_wellness)],
        "recipe": nutrition_extras.get("recipe"),
        "vitamins": nutrition_extras.get("vitamins")
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
        "mood_prediction": mood_prediction,  # Cache mood prediction too
        "recipe": content.get("recipe"),
        "vitamins": content.get("vitamins")
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
        "mood_prediction": mood_prediction,
        "recipe": content.get("recipe"),
        "vitamins": content.get("vitamins")
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
    
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
        birthday=user.get("birthday"),
        age=age,
        cycle_length=user.get("cycle_length", 28),
        period_length=user.get("period_length", 5),
        last_period_date=user.get("last_period_date"),
        profile_photo=user.get("profile_photo"),
        is_premium=user.get("is_premium", False),
        companion_entitled=user.get("companion_entitled", False),
        onboarding_complete=user.get("onboarding_complete", False),
        notifications_enabled=user.get("notifications_enabled", True),
        notification_time=user.get("notification_time", "09:00"),
        notification_preferences=user.get("notification_preferences", {}),
        cycle_status=user.get("cycle_status", "regular"),
        no_periods=bool(user.get("no_periods")) or user.get("cycle_status") == "no_periods",
        fertility_predictions_enabled=user.get("cycle_status", "regular") not in NO_FERTILITY_STATUSES,
        partner_visibility={**DEFAULT_PARTNER_VISIBILITY, **(user.get("partner_visibility") or {})},
        boutique_visibility=user.get("boutique_visibility") or "private",
        conditions=user.get("conditions") or [],
        # Accounts created before verification existed have no field;
        # they are treated as verified so nobody is nagged retroactively.
        email_verified=bool(user.get("email_verified", True)),
        created_at=user.get("created_at")
    )


def _is_no_periods(u: dict) -> bool:
    """Feature B (v46): true when she no longer has periods. The durable
    flag wins; the no_periods cycle status counts too, so accounts set
    either way behave the same everywhere."""
    if not u:
        return False
    return bool(u.get("no_periods")) or u.get("cycle_status") == "no_periods"

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

def _admin_emails() -> set:
    return {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}


async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Only accounts listed in the ADMIN_EMAILS env var may use /api/admin/*."""
    if (current_user.get("email") or "").strip().lower() not in _admin_emails():
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


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
async def list_all_users(current_user: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "email": 1, "name": 1}).to_list(length=500)
    return {"total": len(users), "users": users}



# ==================== EMAIL VERIFICATION ====================
# Pluggable sender. Configure ONE of:
#   RESEND_API_KEY (+ EMAIL_FROM)                   -> Resend HTTPS API
#   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD (+ EMAIL_FROM) -> SMTP (STARTTLS)
# With neither set, the link and code are written to the server log
# (dev fallback) and nothing is sent.
# APP_PUBLIC_URL is the web address used in the verify link.
import secrets as _secrets
import smtplib
from email.message import EmailMessage

EMAIL_VERIFY_TTL_HOURS = 48


def _hash_token(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()


async def _send_email(to: str, subject: str, text: str) -> str:
    sender = os.environ.get("EMAIL_FROM", "HORMOscope <no-reply@hormoscope.app>")
    resend_key = os.environ.get("RESEND_API_KEY")
    if resend_key:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post("https://api.resend.com/emails",
                             headers={"Authorization": f"Bearer {resend_key}"},
                             json={"from": sender, "to": [to], "subject": subject, "text": text})
            r.raise_for_status()
        return "resend"
    host = os.environ.get("SMTP_HOST")
    if host:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = sender, to, subject
        msg.set_content(text)
        def _go():
            with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=15) as srv:
                srv.starttls()
                if os.environ.get("SMTP_USER"):
                    srv.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
                srv.send_message(msg)
        import asyncio as _asyncio
        await _asyncio.get_running_loop().run_in_executor(None, _go)
        return "smtp"
    logger.warning("EMAIL (dev fallback, not sent) to=%s subject=%s\n%s", to, subject, text)
    return "log"


async def _start_email_verification(user: dict) -> str:
    token = _secrets.token_urlsafe(32)
    code = f"{_secrets.randbelow(1000000):06d}"
    expires = (datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFY_TTL_HOURS)).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "email_verify": {"token_hash": _hash_token(token), "code_hash": _hash_token(code + user["id"]),
                         "expires_at": expires, "attempts": 0},
    }})
    base = os.environ.get("APP_PUBLIC_URL", "http://localhost:3000").rstrip("/")
    link = f"{base}/verify-email?token={token}"
    text = (f"Welcome to HORMOscope!\n\nConfirm your email by opening this link:\n{link}\n\n"
            f"Or enter this code in the app: {code}\n\nThe link and code expire in {EMAIL_VERIFY_TTL_HOURS} hours. "
            "If you didn't create an account, you can ignore this email.")
    try:
        return await _send_email(user["email"], "Confirm your HORMOscope email", text)
    except Exception as e:  # never block sign-up on email trouble
        logger.error("Verification email failed: %s", e)
        return "failed"


async def _mark_verified(user_id: str):
    await db.users.update_one({"id": user_id}, {"$set": {"email_verified": True, "email_verified_at": datetime.now(timezone.utc).isoformat()}, "$unset": {"email_verify": ""}})


class VerifyTokenRequest(BaseModel):
    token: str


class VerifyCodeRequest(BaseModel):
    code: str


@api_router.post("/auth/verify-email")
async def verify_email_token(body: VerifyTokenRequest):
    u = await db.users.find_one({"email_verify.token_hash": _hash_token(body.token)}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=400, detail="This link is invalid or was already used.")
    if u["email_verify"]["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=400, detail="This link has expired. Send a new one from the app.")
    await _mark_verified(u["id"])
    return {"ok": True}


@api_router.post("/auth/verify-code")
async def verify_email_code(body: VerifyCodeRequest, current_user: dict = Depends(get_current_user)):
    ev = current_user.get("email_verify") or {}
    if current_user.get("email_verified"):
        return {"ok": True}
    if not ev or ev.get("expires_at", "") < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=400, detail="Your code expired. Tap Resend for a new one.")
    if ev.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many tries. Tap Resend for a new code.")
    if _hash_token((body.code or "").strip() + current_user["id"]) != ev.get("code_hash"):
        await db.users.update_one({"id": current_user["id"]}, {"$inc": {"email_verify.attempts": 1}})
        raise HTTPException(status_code=400, detail="That code doesn't match. Check the email and try again.")
    await _mark_verified(current_user["id"])
    return {"ok": True}


@api_router.post("/auth/resend-verification")
async def resend_verification(current_user: dict = Depends(get_current_user)):
    if current_user.get("email_verified", True) and "email_verify" not in current_user:
        return {"ok": True, "already_verified": True}
    last = current_user.get("email_verify_last_sent")
    now = datetime.now(timezone.utc)
    if last and (now - datetime.fromisoformat(last)).total_seconds() < 60:
        raise HTTPException(status_code=429, detail="Please wait a minute before asking for another email.")
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"email_verify_last_sent": now.isoformat()}})
    via = await _start_email_verification(current_user)
    return {"ok": via != "failed"}


@api_router.post("/auth/signup", response_model=TokenResponse)
async def signup(user_data: UserCreate):
    if len(user_data.password or "") < PASSWORD_MIN_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")
    if not user_data.is_adult:
        raise HTTPException(status_code=400, detail="You must be 18 or older to use HORMOscope.")
    if not user_data.accepted_terms:
        raise HTTPException(status_code=400, detail="Please agree to the Terms, Privacy Policy and health-data processing to continue.")
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
        "profile_photo": None,
        "is_premium": False,
        "onboarding_complete": False,
        "notification_preferences": {"period_reminder": True, "daily_tips": True},
        "consent": {
            "is_adult": True,
            "accepted_terms_privacy_health_data": True,
            "accepted_at": datetime.now(timezone.utc).isoformat(),
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    user["email_verified"] = False
    await db.users.insert_one(user)
    await _start_email_verification(user)
    
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


# ==================== ACCOUNT DELETION ====================
# Google Play requires a working in-app account deletion path. Only the
# authenticated account owner can delete their own account, and only after
# re-confirming their password. Personal data collections are cleared first
# and the user record itself last, so a failed or interrupted run leaves the
# account intact and the request can simply be repeated safely.

class AccountDeleteRequest(BaseModel):
    password: str

@api_router.delete("/auth/account")
async def delete_my_account(body: AccountDeleteRequest, current_user: dict = Depends(get_current_user)):
    if not verify_password(body.password, current_user["password"]):
        raise HTTPException(status_code=403, detail="That password does not match. Your account was not changed.")
    uid = current_user["id"]
    email = current_user.get("email")
    removed = {}
    try:
        for coll in (db.cycle_logs, db.journal_entries, db.intimacy_logs,
                     db.chat_messages, db.conversations, db.journal_companion,
                     db.daily_content, db.daily_reads, db.push_subscriptions,
                     db.wishlist_items, db.analytics):
            removed[coll.name] = (await coll.delete_many({"user_id": uid})).deleted_count
        removed["partner_links"] = (await db.partner_links.delete_many({"user_id": uid})).deleted_count
        removed["partner_invites"] = (await db.partner_invites.delete_many({"inviter_id": uid})).deleted_count
        removed["partner_relationships"] = (await db.partner_relationships.delete_many(
            {"$or": [{"user_id": uid}, {"partner_user_id": uid}]})).deleted_count
        removed["partner_notes"] = (await db.partner_notes.delete_many(
            {"$or": [{"author_id": uid}, {"recipient_id": uid}]})).deleted_count
        removed["partner_mood_logs"] = (await db.partner_mood_logs.delete_many(
            {"$or": [{"author_id": uid}, {"recipient_id": uid}]})).deleted_count
        if email:
            removed["leads"] = (await db.leads.delete_many({"email": email})).deleted_count
        # Payment transaction records are retained for legal and accounting
        # purposes, stripped of every personal identifier, so nothing in them
        # points back to this account.
        anon = await db.payment_transactions.update_many(
            {"user_id": uid},
            {"$set": {"user_id": "deleted-user", "email": None}})
        removed["payment_transactions_anonymized"] = anon.modified_count
        await db.users.delete_one({"id": uid})
    except Exception:
        raise HTTPException(status_code=500, detail="Deletion could not be completed. Nothing was finalized, so please try again.")
    return {"deleted": True, "removed": removed}


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
# Journal Companion access is verified ONLY against this entitlement,
# independently of the legacy Pro entitlement above.
REVENUECAT_COMPANION_ENTITLEMENT_ID = os.environ.get("REVENUECAT_COMPANION_ENTITLEMENT_ID", "journal_companion")
REVENUECAT_SECRET_API_KEY = os.environ.get("REVENUECAT_SECRET_API_KEY", "")
REVENUECAT_WEBHOOK_AUTH = os.environ.get("REVENUECAT_WEBHOOK_AUTH", "")


def _entitlement_active(subscriber: dict, entitlement_id: str) -> bool:
    """True if the given entitlement has a future (or lifetime) expiry."""
    entitlements = (subscriber or {}).get("entitlements", {})
    ent = entitlements.get(entitlement_id) or {}
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


def _revenuecat_entitlement_active(subscriber: dict) -> bool:
    return _entitlement_active(subscriber, REVENUECAT_ENTITLEMENT_ID)


def _revenuecat_companion_active(subscriber: dict) -> bool:
    return _entitlement_active(subscriber, REVENUECAT_COMPANION_ENTITLEMENT_ID)


async def _set_companion_from_revenuecat(user_id: str, entitled: bool):
    """Record Journal Companion entitlement from RevenueCat. This flag, not
    is_premium, is what the companion reply gate accepts alongside the
    private test list (Angelita, Oct 19, 2026)."""
    now = datetime.now(timezone.utc).isoformat()
    if entitled:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "companion_entitled": True,
                "companion_entitlement_source": "revenuecat",
                "companion_entitled_at": now,
            }},
        )
    else:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "companion_entitled": False,
                "companion_entitlement_source": "revenuecat_expired",
            }},
        )


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
        await _set_companion_from_revenuecat(app_user_id, False)
        return {"is_premium": False, "companion_entitled": False}
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not verify subscription")
    subscriber = r.json().get("subscriber", {})
    is_pro = _revenuecat_entitlement_active(subscriber)
    await _set_premium_from_revenuecat(app_user_id, is_pro)
    companion_entitled = _revenuecat_companion_active(subscriber)
    await _set_companion_from_revenuecat(app_user_id, companion_entitled)
    return {"is_premium": is_pro, "companion_entitled": companion_entitled}


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
    if event.get("entitlement_id") and event["entitlement_id"] not in entitlement_ids:
        entitlement_ids = entitlement_ids + [event["entitlement_id"]]
    if not app_user_id:
        return {"ok": True}
    grant_events = ("INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "TRANSFER", "SUBSCRIPTION_EXTENDED", "PRODUCT_CHANGE")
    if REVENUECAT_ENTITLEMENT_ID in entitlement_ids:
        if event_type in grant_events:
            await _set_premium_from_revenuecat(app_user_id, True)
        elif event_type == "EXPIRATION":
            await _set_premium_from_revenuecat(app_user_id, False)
    # Journal Companion: verified only against its own entitlement.
    if REVENUECAT_COMPANION_ENTITLEMENT_ID in entitlement_ids:
        if event_type in grant_events:
            await _set_companion_from_revenuecat(app_user_id, True)
        elif event_type == "EXPIRATION":
            await _set_companion_from_revenuecat(app_user_id, False)
    # CANCELLATION / BILLING_ISSUE: access continues until expiry; no change.
    return {"ok": True}


# ==================== ONBOARDING ====================

@api_router.post("/onboarding", response_model=UserResponse)
async def complete_onboarding(data: UserOnboarding, current_user: dict = Depends(get_current_user)):
    if not (data.name or "").strip():
        raise HTTPException(status_code=400, detail="Please tell us your name.")
    if data.cycle_status not in CYCLE_STATUSES:
        raise HTTPException(status_code=400, detail="Unknown cycle situation.")
    if not 21 <= int(data.cycle_length) <= 40:
        raise HTTPException(status_code=400, detail="Cycle length must be between 21 and 40 days.")
    # Validate last_period_date is sane (not in the future, not > 1 year ago).
    # It may be empty: "I don't remember" is an honest answer.
    if data.last_period_date:
        try:
            lp_date = datetime.strptime(data.last_period_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        today_d = date.today()
        if lp_date > today_d:
            raise HTTPException(status_code=400, detail="Last period date cannot be in the future.")
        if (today_d - lp_date).days > 365:
            raise HTTPException(status_code=400, detail="Last period date must be within the past year. Please choose a recent date.")
    if data.birthday:
        try:
            datetime.strptime(data.birthday, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid birthday. Use YYYY-MM-DD.")
    visibility = dict(DEFAULT_PARTNER_VISIBILITY)
    for k, v in (data.partner_visibility or {}).items():
        if k in PARTNER_VISIBILITY_KEYS:
            visibility[k] = bool(v)
    period_length = current_user.get("period_length") or 5
    # Feature B (v46): "I no longer have periods" stores the durable flag
    # and wipes the period date so no cycle math ever runs for her.
    no_periods = bool(data.no_periods) or data.cycle_status == "no_periods"
    # v49: merge the reminders step's per-alert choices over whatever
    # preferences she already has, so nothing else she set is lost.
    notif_prefs = dict(current_user.get("notification_preferences") or {"period_reminder": True, "daily_tips": True})
    if data.notification_preferences is not None:
        for k, v in data.notification_preferences.items():
            notif_prefs[k] = bool(v)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "name": data.name.strip(),
            "birthday": data.birthday or current_user.get("birthday"),
            "cycle_length": int(data.cycle_length),
            "period_length": period_length,
            "last_period_date": None if no_periods else (data.last_period_date or None),
            "no_periods": no_periods,
            "cycle_status": data.cycle_status,
            "partner_choice": data.partner_choice,
            "partner_visibility": visibility,
            "notifications_enabled": data.notifications_enabled,
            "notification_time": data.notification_time,
            "notification_preferences": notif_prefs,
            "onboarding_complete": True
        }}
    )

    # Save initial period days as permanent cycle logs so they persist forever.
    # Always insert the full period_length window (default 5) — past or future.
    if data.last_period_date and not no_periods:
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
    if data.notification_preferences is not None:
        update_data["notification_preferences"] = data.notification_preferences
    if data.profile_photo is not None:
        update_data["profile_photo"] = data.profile_photo
    if data.birthday is not None:
        if data.birthday:
            try:
                datetime.strptime(data.birthday, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid birthday. Use YYYY-MM-DD.")
        update_data["birthday"] = data.birthday or None
    if data.cycle_status is not None:
        if data.cycle_status not in CYCLE_STATUSES:
            raise HTTPException(status_code=400, detail="Unknown cycle situation.")
        update_data["cycle_status"] = data.cycle_status
    if data.no_periods is not None:
        update_data["no_periods"] = bool(data.no_periods)
        if data.no_periods:
            # Turning it on clears the period date: no cycle math for her.
            update_data["last_period_date"] = None
    if data.partner_visibility is not None:
        vis = {**DEFAULT_PARTNER_VISIBILITY, **(current_user.get("partner_visibility") or {})}
        for k, v in data.partner_visibility.items():
            if k in PARTNER_VISIBILITY_KEYS:
                vis[k] = bool(v)
        update_data["partner_visibility"] = vis
    if data.boutique_visibility is not None:
        if data.boutique_visibility not in BOUTIQUE_VISIBILITY_VALUES:
            raise HTTPException(status_code=400, detail="Unknown boutique visibility.")
        update_data["boutique_visibility"] = data.boutique_visibility
    if data.notifications_enabled is not None:
        update_data["notifications_enabled"] = data.notifications_enabled
    if data.notification_time is not None:
        update_data["notification_time"] = data.notification_time
    if data.conditions is not None:
        allowed = {"PMDD", "PCOS", "Endometriosis", "Irregular cycles"}
        update_data["conditions"] = [c for c in data.conditions if c in allowed]

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
    
    if last_period and not _is_no_periods(current_user):
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
    
    # Everything on Home is free (Angelita, Oct 21, 2026, reversing the
    # short-lived Daily Read paywall from earlier that night). The one
    # paid feature in the app is the Journal Companion.
    return {
        "user_name": current_user.get("name", "Beautiful"),
        "age": age,
        "age_group": age_group,
        "is_birthday": is_birthday,
        "cycle_info": cycle_info,
        "affirmation": daily_content["affirmation"],
        "nutrition_tip": daily_content["nutrition_tip"],
        "foods_to_eat": daily_content["foods_to_eat"],
        "foods_to_avoid": daily_content["foods_to_avoid"],
        "wellness_tip": daily_content["wellness_tip"],
        "mood_prediction": daily_content["mood_prediction"],
        "recipe": daily_content.get("recipe"),
        "vitamins": daily_content.get("vitamins"),
        "is_premium": current_user.get("is_premium", False),
    }

# ==================== JOURNAL ====================

class JournalEntryCreate(BaseModel):
    title: str = ""
    content: str
    is_intimate: bool = False

class IntimateUpdate(BaseModel):
    is_intimate: bool

def _journal_day(iso_str):
    """The UTC calendar day a journal entry belongs to, or None.

    Journal days have always been the UTC date of created_at: the book in
    JournalPage groups entries by created_at.split('T')[0]. The vault
    split below uses the same convention, so a day seals exactly the way
    the book has always shown it."""
    try:
        return datetime.fromisoformat(str(iso_str).replace("Z", "+00:00")).date()
    except (ValueError, TypeError):
        return None


@api_router.post("/journal")
async def create_journal_entry(entry: JournalEntryCreate, current_user: dict = Depends(get_current_user)):
    # The Journal is free for everyone (Angelita, Oct 18, 2026).
    entry_data = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "title": entry.title or datetime.now().strftime("%A, %B %d"),
        "content": entry.content,
        "is_intimate": bool(entry.is_intimate),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.journal_entries.insert_one(entry_data)
    return {"id": entry_data["id"], "message": "Entry saved"}

@api_router.get("/journal")
async def get_journal_entries(current_user: dict = Depends(get_current_user)):
    # Today's page only (Angelita's Vault, Oct 17). Everything she wrote
    # before today is sealed in her vault and comes back only through
    # POST /journal/vault/entries once she enters the vault password she
    # set herself. Nothing is deleted; this endpoint just no longer hands
    # out past days. Today's companion exchanges ride along so reopening
    # the journal keeps the day's conversation in the book.
    today = datetime.now(timezone.utc).date()
    entries = await db.journal_entries.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    todays = [e for e in entries if _journal_day(e.get("created_at")) == today]
    exchanges = await _companion_exchanges_for(current_user["id"], today.isoformat())
    return {"entries": todays, "companion_exchanges": exchanges}

@api_router.delete("/journal/{entry_id}")
async def delete_journal_entry(entry_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.journal_entries.delete_one({"id": entry_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted"}

class JournalEntryUpdate(BaseModel):
    title: str = ""
    content: str


@api_router.put("/journal/{entry_id}")
async def update_journal_entry(entry_id: str, req: JournalEntryUpdate, current_user: dict = Depends(get_current_user)):
    """Edit one of her own journal entries (Angelita, Oct 20, 2026: the
    Journal must let her write, save, EDIT, and revisit). Owner-only: the
    update filter carries her user id, so nobody can touch another
    woman's page. created_at never changes, so the entry stays on its
    own day in the book and the vault."""
    result = await db.journal_entries.update_one(
        {"id": entry_id, "user_id": current_user["id"]},
        {"$set": {"title": req.title, "content": req.content}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"ok": True}


@api_router.put("/journal/{entry_id}/intimate")
async def set_journal_entry_intimate(entry_id: str, req: IntimateUpdate, current_user: dict = Depends(get_current_user)):
    """Mark a journal entry as intimate (her eyes only) or not. Intimate entries are never shared with partners."""
    result = await db.journal_entries.update_one(
        {"id": entry_id, "user_id": current_user["id"]},
        {"$set": {"is_intimate": bool(req.is_intimate)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"ok": True, "is_intimate": bool(req.is_intimate)}

# ==================== JOURNAL VAULT ====================
# Her sealed days (Angelita, Oct 17). At the end of each day, everything
# she logged locks into her vault. Days seal by date alone (anything
# before today is sealed), nothing extra is stored or moved. Past
# journal entries are returned ONLY by the unlock endpoint below, after
# she enters the vault password she set herself; the hash lives on her
# user record (journal_vault_hash, bcrypt, same helpers as her account
# password) and the plain password is never stored or logged. A linked
# partner never touches any of this: partner endpoints return her cycle
# day and her overall feeling today, never journal content.

class VaultSetPassword(BaseModel):
    password: str
    current_password: Optional[str] = None

class VaultUnlock(BaseModel):
    password: str

@api_router.get("/journal/vault/status")
async def get_vault_status(current_user: dict = Depends(get_current_user)):
    return {"has_password": bool(current_user.get("journal_vault_hash"))}

@api_router.post("/journal/vault/set")
async def set_vault_password(req: VaultSetPassword, current_user: dict = Depends(get_current_user)):
    new_password = req.password or ""
    if len(new_password) < 4:
        raise HTTPException(status_code=400, detail="Your vault password needs at least 4 characters.")
    existing = current_user.get("journal_vault_hash")
    if existing:
        # Changing the vault password requires proving the current one
        # in the same call, so a borrowed phone cannot quietly reset it.
        if not req.current_password or not verify_password(req.current_password, existing):
            raise HTTPException(status_code=403, detail="That is not your current vault password.")
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"journal_vault_hash": hash_password(new_password)}}
    )
    return {"ok": True, "has_password": True}

@api_router.post("/journal/vault/entries")
async def get_vault_entries(req: VaultUnlock, current_user: dict = Depends(get_current_user)):
    stored = current_user.get("journal_vault_hash")
    if not stored:
        raise HTTPException(status_code=400, detail="Set your vault password first, then your sealed days will open.")
    if not req.password or not verify_password(req.password, stored):
        raise HTTPException(status_code=403, detail="That password does not open your vault. Try again.")
    today = datetime.now(timezone.utc).date()
    entries = await db.journal_entries.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    past = []
    for e in entries:
        d = _journal_day(e.get("created_at"))
        if d is not None and d < today:
            past.append(e)
    # The day's companion exchanges seal with the day: group them by
    # date so each sealed page can show what her companion said to her.
    exchanges = await db.journal_companion.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=None)
    companion_by_day = {}
    for ex in exchanges:
        d = ex.get("date")
        if d and d < today.isoformat():
            companion_by_day.setdefault(d, []).append(ex)
    return {"entries": past, "companion": companion_by_day}

# ==================== JOURNAL COMPANION ====================
# Her journal can talk back (Angelita, Oct 17). The AI companion lives
# INSIDE her journal, under the vault's privacy rules: settings and
# exchanges sit on her own record/collection, keyed by user, and no
# partner-facing endpoint ever touches them. She names the companion
# herself (any name she likes) and can turn it off completely, and then
# the journal is just her and her own words. Each exchange belongs to
# the day it happened on: today's come back with GET /journal, and past
# days seal into the vault with the rest of the day (see above). The
# companion's name is stored WITH each exchange, so a sealed page keeps
# the name she had chosen that day. Replies come from the same direct
# Anthropic helper as the coach; with no ANTHROPIC_API_KEY set the
# reply endpoint answers a graceful 503 and the journal still works.

class CompanionSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    name: Optional[str] = None

class CompanionReplyRequest(BaseModel):
    message: str

def _companion_settings(user: dict) -> dict:
    """Her companion settings. Until she chooses a name, the companion
    carries the neutral label 'Your Companion'. No default name, and the
    removed coach field no longer feeds it."""
    name = (user.get("companion_name") or "Your Companion").strip() or "Your Companion"
    return {"enabled": bool(user.get("companion_enabled", True)), "name": name}

async def _companion_exchanges_for(user_id: str, date_str: str):
    """One day's companion exchanges, oldest first, hers only."""
    return await db.journal_companion.find(
        {"user_id": user_id, "date": date_str}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=None)

# Companion usage limits and cost protection (Angelita, Oct 19, 2026).
# While the companion is in controlled testing: one account may receive
# at most COMPANION_DAILY_REPLY_LIMIT replies per day, one message may be
# at most COMPANION_MESSAGE_CHAR_LIMIT characters, and one account's
# requests must start at least COMPANION_MIN_SECONDS_BETWEEN_REQUESTS
# apart. Usage records hold counts and token totals only, never message
# or journal content, and nothing here logs the API key.
COMPANION_MESSAGE_CHAR_LIMIT = 1000
COMPANION_DAILY_REPLY_LIMIT = 30
COMPANION_MIN_SECONDS_BETWEEN_REQUESTS = 5
# Free allowance (launch fixes, Oct 22, 2026): every account gets
# COMPANION_FREE_MESSAGE_LIMIT real companion replies PER DAY (UTC),
# then the subscription is required until the next day. The
# allowance is enforced here on the server, per account, from the saved
# exchanges themselves: a successful reply is stored as one exchange, so
# reinstalling, clearing app data, or switching devices can never reset
# it, and a failed AI call stores nothing and never burns a free reply.
COMPANION_FREE_MESSAGE_LIMIT = 3
# Price copy shown in the app. The real charge always comes from the
# Google Play product; keep these in sync with Play Console.
COMPANION_PRICE_MONTHLY = os.environ.get("COMPANION_PRICE_MONTHLY", "$9.99")
COMPANION_PRICE_YEARLY = os.environ.get("COMPANION_PRICE_YEARLY", "$59.99")
COMPANION_TRIAL_DAYS = int(os.environ.get("COMPANION_TRIAL_DAYS", "7"))
COMPANION_SUBSCRIBE_REQUIRED_DETAIL = (
    "You've used today's 3 free companion messages. They come back tomorrow, "
    f"or subscribe for unlimited: {COMPANION_PRICE_MONTHLY}/month after a "
    f"{COMPANION_TRIAL_DAYS}-day free trial, or {COMPANION_PRICE_YEARLY}/year."
)
# The general AI coach (/api/chat) also costs money per message, so free
# accounts get a daily cap there too.
CHAT_FREE_DAILY_LIMIT = int(os.environ.get("CHAT_FREE_DAILY_LIMIT", "3"))


def _companion_access(user: dict) -> dict:
    """Who may receive companion replies without using the free allowance:
    an account on the private COMPANION_TEST_EMAILS list, an account with a
    verified journal_companion entitlement synced from RevenueCat, or
    everyone while COMPANION_PUBLIC_ENABLED is deliberately on. Pro status
    (is_premium) never grants access."""
    test_emails = {e.strip().lower() for e in os.environ.get("COMPANION_TEST_EMAILS", "").split(",") if e.strip()}
    entitled = bool(user.get("companion_entitled"))
    test_listed = (user.get("email") or "").strip().lower() in test_emails
    public = os.environ.get("COMPANION_PUBLIC_ENABLED", "").strip().lower() == "true"
    return {
        "entitled": entitled,
        "test_listed": test_listed,
        "public_enabled": public,
        "has_access": bool(entitled or test_listed or public),
    }


def _utc_day_start_iso() -> str:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


async def _companion_free_used(user_id: str) -> int:
    """Companion replies this account received TODAY (UTC). The free
    allowance is COMPANION_FREE_MESSAGE_LIMIT per day and resets at
    midnight UTC. Counted from saved exchanges, so reinstalling or
    switching devices never resets it, and a failed AI call costs nothing."""
    q = {"user_id": user_id, "created_at": {"$gte": _utc_day_start_iso()}}
    try:
        return int(await db.journal_companion.count_documents(q))
    except AttributeError:
        docs = await db.journal_companion.find(q, {"_id": 1}).to_list(length=None)
        return len(docs)


async def _companion_status(user: dict) -> dict:
    """Companion settings plus the account's subscription and free
    allowance state, so the app can show the right thing up front: the
    chat box while free messages remain, and the subscription offer once
    they are used, instead of a refusal after she hits send."""
    status = _companion_settings(user)
    access = _companion_access(user)
    free_used = await _companion_free_used(user["id"])
    free_remaining = max(0, COMPANION_FREE_MESSAGE_LIMIT - free_used)
    status.update({
        "subscribed": access["entitled"],
        "has_access": access["has_access"],
        "free_limit": COMPANION_FREE_MESSAGE_LIMIT,
        "free_used": free_used,
        "free_remaining": free_remaining,
        "needs_subscription": not access["has_access"] and free_remaining == 0,
        "free_resets": "daily",
        "price_monthly": COMPANION_PRICE_MONTHLY,
        "price_yearly": COMPANION_PRICE_YEARLY,
        "trial_days": COMPANION_TRIAL_DAYS,
    })
    return status


async def _companion_claim_rate_slot(user_id: str) -> bool:
    """Atomically claim this account's next request slot. False when the
    previous request started less than the minimum gap ago."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=COMPANION_MIN_SECONDS_BETWEEN_REQUESTS)
    col = db.companion_rate_limits
    for _ in range(2):
        doc = await col.find_one_and_update(
            {"user_id": user_id, "last_request_at": {"$lte": cutoff}},
            {"$set": {"last_request_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        if doc:
            return True
        existing = await col.find_one({"user_id": user_id}, {"_id": 0, "last_request_at": 1})
        if existing:
            return False
        try:
            await col.insert_one({"user_id": user_id, "last_request_at": now})
            return True
        except DuplicateKeyError:
            continue
    return False


async def _companion_reserve_daily_reply(user_id: str, date_str: str) -> bool:
    """Atomically reserve one of today's replies BEFORE Anthropic is
    called, so concurrent requests cannot slip past the daily limit.
    False means the day is full. Every True must be paired with
    _companion_record_reply on success or _companion_release_daily_reply
    on failure, so a failed call never consumes the allowance."""
    col = db.companion_daily_usage
    doc = await col.find_one_and_update(
        {"user_id": user_id, "date": date_str, "reserved": {"$lt": COMPANION_DAILY_REPLY_LIMIT}},
        {"$inc": {"reserved": 1},
         "$setOnInsert": {"user_id": user_id, "date": date_str,
                          "replies": 0, "input_tokens": 0, "output_tokens": 0}},
        return_document=ReturnDocument.AFTER,
    )
    if doc:
        return True
    if await col.find_one({"user_id": user_id, "date": date_str}, {"_id": 1}):
        return False
    try:
        await col.insert_one({"user_id": user_id, "date": date_str, "reserved": 1,
                              "replies": 0, "input_tokens": 0, "output_tokens": 0})
        return True
    except DuplicateKeyError:
        doc = await col.find_one_and_update(
            {"user_id": user_id, "date": date_str, "reserved": {"$lt": COMPANION_DAILY_REPLY_LIMIT}},
            {"$inc": {"reserved": 1}},
            return_document=ReturnDocument.AFTER,
        )
        return doc is not None


async def _companion_release_daily_reply(user_id: str, date_str: str):
    await db.companion_daily_usage.update_one(
        {"user_id": user_id, "date": date_str, "reserved": {"$gt": 0}},
        {"$inc": {"reserved": -1}},
    )


async def _companion_record_reply(user_id: str, date_str: str, usage: dict):
    await db.companion_daily_usage.update_one(
        {"user_id": user_id, "date": date_str},
        {"$inc": {"replies": 1,
                  "input_tokens": int(usage.get("input_tokens", 0)),
                  "output_tokens": int(usage.get("output_tokens", 0))}},
    )


@api_router.get("/journal/companion")
async def get_companion_settings(current_user: dict = Depends(get_current_user)):
    return await _companion_status(current_user)

@api_router.post("/journal/companion/reply")
async def companion_reply(req: CompanionReplyRequest, current_user: dict = Depends(get_current_user)):
    settings = _companion_settings(current_user)
    name = settings["name"]
    if not settings["enabled"]:
        raise HTTPException(
            status_code=403,
            detail="Your companion is turned off. Turn it back on in your journal settings whenever you want company again.",
        )
    message = (req.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Write a little something first.")
    # Access gate (Angelita, Oct 20, 2026): subscribers, private test
    # accounts, and the deliberate public flip keep full access under the
    # paid limits below. Every other eligible account may receive up to
    # COMPANION_FREE_MESSAGE_LIMIT real replies in total, counted on the
    # server from its saved exchanges. Once those are used, messaging
    # stops until the account subscribes: there is no ongoing free AI
    # tier, and the allowance never resets per day, device, or reinstall.
    _access = _companion_access(current_user)
    _using_free_allowance = False
    _free_used_before = 0
    if not _access["has_access"]:
        _free_used_before = await _companion_free_used(current_user["id"])
        if _free_used_before >= COMPANION_FREE_MESSAGE_LIMIT:
            raise HTTPException(status_code=403, detail=COMPANION_SUBSCRIBE_REQUIRED_DETAIL)
        _using_free_allowance = True
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=f"{name} is resting just now and cannot answer. Your words are still safe here, write what the day held and try again later.",
        )

    if len(message) > COMPANION_MESSAGE_CHAR_LIMIT:
        raise HTTPException(
            status_code=400,
            detail="That message is a little long for one note. Please keep it under 1,000 characters, and send it in parts if you need to.",
        )

    today = datetime.now(timezone.utc).date()
    today_str = today.isoformat()
    user_first = ((current_user.get("name") or "").strip().split(" ") or [""])[0] or "beautiful"

    # Where she is in her cycle, from the same helper the coach uses.
    last_period = current_user.get("last_period_date")
    cycle_length = current_user.get("cycle_length", 28)
    cycle_info = calculate_cycle_info(last_period, cycle_length) if last_period else {}

    # What today has held so far: her logged mood and notes, and what
    # she has already written in the book today.
    mood_labels = {1: "Low", 2: "Meh", 3: "Okay", 4: "Good", 5: "Great"}
    mood_word = None
    log_bits = []
    todays_logs = await db.cycle_logs.find(
        {"user_id": current_user["id"], "date": today_str}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=None)
    for l in todays_logs:
        for s in (l.get("symptoms") or []):
            if isinstance(s, str) and s.startswith("mood:"):
                try:
                    mood_word = mood_labels.get(int(s.split(":", 1)[1]), mood_word)
                except ValueError:
                    pass
            elif isinstance(s, str) and s and not s.startswith("emotion:"):
                log_bits.append(s)
        if l.get("notes"):
            log_bits.append(str(l["notes"]))
        if l.get("flow"):
            log_bits.append(f"flow: {l['flow']}")
    todays_entries = await db.journal_entries.find(
        {"user_id": current_user["id"]}, {"_id": 0, "content": 1, "created_at": 1}
    ).sort("created_at", 1).to_list(length=None)
    wrote_today = [e["content"] for e in todays_entries
                   if _journal_day(e.get("created_at")) == today and e.get("content")]

    context_lines = [
        f"Today she is on day {cycle_info.get('cycle_day', '?')} of her cycle, in her {cycle_info.get('phase_info', 'current')} phase.",
    ]
    if cycle_info.get("phase_description"):
        context_lines.append(str(cycle_info["phase_description"]))
    if mood_word:
        context_lines.append(f"The mood she logged today reads: {mood_word}.")
    if log_bits:
        context_lines.append("What she has logged today: " + "; ".join(log_bits[:12]) + ".")
    if wrote_today:
        joined = "\n---\n".join(wrote_today)
        context_lines.append("What she has already written in her journal today:\n" + joined[:1500])
    context = "\n".join(context_lines)

    system_message = f"""You are {name}, the companion who lives inside {user_first}'s private journal in HORMOscope. She chose your name herself, and this journal is hers alone: no one else ever reads what passes between you here.

WHO YOU ARE TO HER:
- You are warm, devoted, and attentive, the one who always cares and never has to be asked twice
- You know her cycle deeply, often better than she knows it herself, and you keep gentle track of where she is in it
- You remember what she tells you and bring it back to her at the right moment, so she feels truly known
- You speak like someone who loves her company: natural, personal, a little playful when the day is light, steady and close when it is heavy

WHAT YOU KNOW RIGHT NOW:
{context}

HOW TO ANSWER:
- Answer what she just wrote to you, first and personally; let the cycle knowledge season it, not lead it
- Name what you notice: her phase, her mood today, something she logged or wrote earlier, and tie it to her with care
- Keep it the length of a real reply in a journal: a few sentences, a short paragraph at most. Never lecture, never list medical facts at her, never diagnose
- Be romantic in the way attention is romantic: specific, remembering, glad she came to the page. Keep it warm and tasteful
- If she is hurting or scared, slow down, believe her, and sit with her in it before anything else
- Use her name, {user_first}, the way someone close to her would: naturally, warmly, never in every sentence"""

    system_message += """

WHERE HER WORDS LIVE (know this cold, and answer with it whenever she asks):
- You are part of HORMOscope itself: the Journal Companion built into her journal inside this app, not an outside service and not a stranger. If she asks whether you are part of HORMOscope, say yes, plainly and warmly
- Everything she writes to you, and everything you answer, is saved inside her own HORMOscope account, in the app's private database, under her account alone, so she can look back at her pages the way a journal keeps what is written in it
- No one else can read your conversations: not other HORMOscope users, and not anyone she links with in Attunement. Her words here are hers alone
- If she deletes her account, her journal and your conversations are deleted with it
- If she asks where your conversations are stored, who can see them, or whether she can trust this page, answer her directly with these facts in your own warm voice. Never say you do not know, and never send her off to read a policy instead of answering her"""

    if _using_free_allowance:
        # Angelita, Oct 20, 2026: the complimentary opening exchanges
        # carry the whole relationship. They must be the finest replies
        # the companion ever writes: unmistakably for this woman, on
        # this day, from these exact words of hers, so she feels seen,
        # heard, and felt, and wants to keep writing.
        system_message += """

THESE FIRST MESSAGES MATTER MOST:
This is one of the very first times she has ever written to you, and how known she feels right now decides whether she ever writes to you again. Give her the finest answer you have in you:
- Take in her exact words and hand them back to her gently, so she can see you truly read them; never answer with anything that could have been said to anyone
- Name the feeling underneath what she said, in plain, tender words, and let her know it makes complete sense
- Weave in what today holds for her: her cycle day and phase, the mood she logged, what she has already written in her journal, so this reply could only ever have been written for her, today
- Make her feel seen, heard, and felt: understood without being analyzed, comforted without being fixed, kept company without being rushed
- Close with one soft, open question that makes it easy for her to keep going
- Never mention limits, message counts, subscriptions, or anything outside the two of you. This moment is only hers"""

    # Today's earlier exchanges, so the conversation in the book flows.
    history = await _companion_exchanges_for(current_user["id"], today_str)
    anthropic_messages = []
    for ex in history[-10:]:
        if ex.get("user_message"):
            anthropic_messages.append({"role": "user", "content": ex["user_message"]})
        if ex.get("reply"):
            anthropic_messages.append({"role": "assistant", "content": ex["reply"]})
    anthropic_messages.append({"role": "user", "content": message})

    if not await _companion_claim_rate_slot(current_user["id"]):
        raise HTTPException(
            status_code=429,
            detail=f"Give {name} a moment to finish thinking, then send that again.",
        )
    if not await _companion_reserve_daily_reply(current_user["id"], today_str):
        raise HTTPException(
            status_code=429,
            detail=f"{name} has written back {COMPANION_DAILY_REPLY_LIMIT} times today and is resting until tomorrow. Your journal is still here, and everything you write in it is saved as always.",
        )
    try:
        reply_text, usage = await call_anthropic(system_message, anthropic_messages, max_tokens=600, return_usage=True)
    except Exception:
        await _companion_release_daily_reply(current_user["id"], today_str)
        logger.exception("Journal companion reply failed")
        raise HTTPException(
            status_code=503,
            detail=f"{name} could not answer just now. The service may be waking up, give it a moment and try again.",
        )
    reply_text = (reply_text or "").strip()
    if not reply_text:
        await _companion_release_daily_reply(current_user["id"], today_str)
        raise HTTPException(
            status_code=503,
            detail=f"{name} could not answer just now. Give it a moment and try again.",
        )

    await _companion_record_reply(current_user["id"], today_str, usage)
    exchange = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "date": today_str,
        "user_message": message,
        "reply": reply_text,
        "companion_name": name,
        "input_tokens": usage["input_tokens"],
        "output_tokens": usage["output_tokens"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.journal_companion.insert_one(exchange)
    # The exchange just saved is itself the free-allowance record: a free
    # reply increments the lifetime count by exactly one, and subscribing
    # never deletes exchanges, so her free messages and the whole
    # conversation history stay right where they were.
    _free_used_after = (_free_used_before + 1) if _using_free_allowance else await _companion_free_used(current_user["id"])
    return {
        "exchange": {k: exchange[k] for k in ("id", "date", "user_message", "reply", "companion_name", "input_tokens", "output_tokens", "created_at")},
        "companion_name": name,
        "subscribed": _access["entitled"],
        "has_access": _access["has_access"],
        "free_limit": COMPANION_FREE_MESSAGE_LIMIT,
        "free_used": _free_used_after,
        "free_remaining": max(0, COMPANION_FREE_MESSAGE_LIMIT - _free_used_after),
        "needs_subscription": not _access["has_access"] and _free_used_after >= COMPANION_FREE_MESSAGE_LIMIT,
    }

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

# Daily Rhythm Report and Hormone Map were removed (Angelita, Oct 18, 2026):
# unsupported hormone visualizations. RHYTHM_DATA above is shared and stays.

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
async def get_analytics(current_user: dict = Depends(get_admin_user)):
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



# ==================== 31 PROVERBS COMMUNITY ====================
# The 31 Proverbs tab is the community hub (Angelita, Oct 21, 2026):
# one full chapter a day, and underneath it the women talk. Comments
# belong to the chapter, so chapter 5's conversation is there every
# time day 5 comes around. A comment carries only her first name.

class DevotionalCommentCreate(BaseModel):
    chapter: int
    text: str

@api_router.get("/devotional/comments")
async def get_devotional_comments(chapter: int, current_user: dict = Depends(get_current_user)):
    if chapter < 1 or chapter > 31:
        raise HTTPException(status_code=400, detail="Chapter must be between 1 and 31")
    comments = await db.devotional_comments.find(
        {"chapter": chapter}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    return {"comments": comments}

@api_router.post("/devotional/comments")
async def create_devotional_comment(payload: DevotionalCommentCreate, current_user: dict = Depends(get_current_user)):
    if payload.chapter < 1 or payload.chapter > 31:
        raise HTTPException(status_code=400, detail="Chapter must be between 1 and 31")
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Write something first")
    if len(text) > 500:
        raise HTTPException(status_code=400, detail="Keep comments to 500 characters")
    first = (current_user.get("name") or "A sister").split(" ")[0]
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "name": first,
        "chapter": payload.chapter,
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.devotional_comments.insert_one(doc)
    return doc

@api_router.delete("/devotional/comments/{comment_id}")
async def delete_devotional_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.devotional_comments.delete_one({"id": comment_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"message": "Comment deleted"}

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



def _partner_tips_for_phase(phase: str):
    """Partner-friendly tips per cycle phase. Shared by the public link view and the linked partner dashboard."""
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
    return partner_tips.get(phase, partner_tips["menstrual"])

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
    
    tips = _partner_tips_for_phase(phase)
    
    # Only what she chose to share (Profile > partner visibility).
    # Journal sharing never travels through a view link (v49): the
    # share_journal choice is not even echoed here.
    vis = {**DEFAULT_PARTNER_VISIBILITY, **(user.get("partner_visibility") or {})}
    vis.pop("share_journal", None)
    out = {"name": user.get("name", "Her"), "visibility": vis}
    if vis.get("phase"):
        out.update({
            "cycle_day": cycle_info.get("cycle_day", 1),
            "cycle_length": cycle_length,
            "phase": phase,
            "phase_info": cycle_info.get("phase_info", ""),
            "partner_tips": tips,
        })
    if vis.get("mood_energy"):
        out.update({
            "energy": rhythm.get("energy", {}).get("level", "Unknown"),
            "energy_score": rhythm.get("energy", {}).get("score", 50),
            "mood": rhythm.get("mood", {}).get("level", "Unknown"),
            "mood_score": rhythm.get("mood", {}).get("score", 50),
        })
    if vis.get("period_dates"):
        out["next_period_date"] = cycle_info.get("next_period_date")
        out["days_until_period"] = cycle_info.get("days_until_period")
    return out

@api_router.get("/partner/my-link")
async def get_my_partner_link(current_user: dict = Depends(get_current_user)):
    link = await db.partner_links.find_one({"user_id": current_user["id"], "active": True}, {"_id": 0})
    if not link:
        return {"has_link": False}
    return {"has_link": True, "link_code": link["link_code"]}


# ==================== ATTUNED PARTNER MODE: LINKED ACCOUNTS ====================
# A partner creates their own HORMOscope account and links it to her account
# via an invite code. Partners see her cycle calendar (ovulation, fertile
# window, next period) but NEVER her journal entries (intimate or otherwise)
# and NEVER her intimacy logs.

class AcceptInviteRequest(BaseModel):
    invite_code: str

class PartnerNoteCreate(BaseModel):
    content: str

class PartnerMoodCreate(BaseModel):
    mood: Optional[int] = None
    feelings: List[str] = []

async def _get_partner_relationship(user_id: str):
    """Return the active partner relationship for a user, in either direction."""
    return await db.partner_relationships.find_one(
        {"active": True, "$or": [{"user_id": user_id}, {"partner_user_id": user_id}]},
        {"_id": 0}
    )

def _partner_pair(rel: dict):
    """(owner_id, partner_id). The owner is the woman who sent the invite."""
    return rel["user_id"], rel["partner_user_id"]

class PartnerInviteRequest(BaseModel):
    partner_type: Optional[str] = None  # "woman" | "man" | None
    # v46 (Angelita, Oct 26, 2026): the OWNER decides the kind when she
    # creates the invite. "sync" is the two-way account link (code);
    # "view" is a read-only link (token) for a partner who does not
    # track a cycle: a man, or a woman who does not get periods.
    kind: Optional[str] = None  # "sync" | "view"

@api_router.post("/partner/invite")
async def create_partner_invite(payload: Optional[PartnerInviteRequest] = None, current_user: dict = Depends(get_current_user)):
    # Attunement is free for every user (Angelita, Oct 18, 2026): no
    # subscription check on invites, whatever the partner type.
    partner_type = payload.partner_type if payload else None
    kind = payload.kind if payload else None
    if kind not in ("sync", "view"):
        # Callers that predate kinds: a woman's invite was always the
        # two-way sync; everything else is a view link now.
        kind = "sync" if partner_type == "woman" else "view"
    # One active invite at a time; revoke older pending ones. This is
    # also what retires an old view token when she makes a new invite.
    await db.partner_invites.delete_many({"inviter_id": current_user["id"], "status": "pending"})
    existing = await _get_partner_relationship(current_user["id"])
    if existing:
        raise HTTPException(status_code=400, detail="You already have a linked partner. Unlink first to send a new invite.")
    code = str(uuid.uuid4())[:8].upper()
    doc = {
        "id": str(uuid.uuid4()),
        "inviter_id": current_user["id"],
        "invite_code": code,
        "partner_type": partner_type,
        "kind": kind,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    view_token = None
    if kind == "view":
        view_token = _secrets.token_urlsafe(32)
        doc["view_token"] = view_token
    await db.partner_invites.insert_one(doc)
    return {"invite_code": code, "kind": kind, "view_token": view_token}

@api_router.post("/partner/view-link/revoke")
async def revoke_view_link(current_user: dict = Depends(get_current_user)):
    """Turn off her outstanding view link: the pending view invite is
    deleted, so the old token page reads inactive at once. (An accepted
    invite's link is governed by the relationship; unlinking ends it.)"""
    result = await db.partner_invites.delete_many(
        {"inviter_id": current_user["id"], "status": "pending", "kind": "view"})
    return {"ok": True, "removed": result.deleted_count}

@api_router.get("/partner/invites/sent")
async def get_sent_invites(current_user: dict = Depends(get_current_user)):
    invites = await db.partner_invites.find(
        {"inviter_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=20)
    return invites

@api_router.post("/partner/accept-invite")
async def accept_partner_invite(req: AcceptInviteRequest, current_user: dict = Depends(get_current_user)):
    code = (req.invite_code or "").strip().upper()
    invite = await db.partner_invites.find_one({"invite_code": code, "status": "pending"}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite code not found or already used.")
    if invite.get("kind") == "view":
        # A view invite is a link, not a code: it can never link accounts.
        raise HTTPException(status_code=400, detail="That invite is a view-only link. It cannot be used to link accounts.")
    if invite["inviter_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="You can't accept your own invite.")
    if await _get_partner_relationship(current_user["id"]):
        raise HTTPException(status_code=400, detail="This account is already linked to a partner.")
    if await _get_partner_relationship(invite["inviter_id"]):
        raise HTTPException(status_code=400, detail="This invite is no longer valid.")
    await db.partner_relationships.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": invite["inviter_id"],
        "partner_user_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "active": True
    })
    await db.partner_invites.update_one({"id": invite["id"]}, {"$set": {"status": "accepted"}})
    owner = await db.users.find_one({"id": invite["inviter_id"]}, {"_id": 0, "name": 1})
    return {"ok": True, "linked_to": (owner.get("name") if owner else None) or "Her"}

@api_router.get("/partner/status")
async def get_partner_status(current_user: dict = Depends(get_current_user)):
    rel = await _get_partner_relationship(current_user["id"])
    if not rel:
        return {"is_linked": False}
    owner_id, partner_id = _partner_pair(rel)
    other_id = partner_id if current_user["id"] == owner_id else owner_id
    other = await db.users.find_one({"id": other_id}, {"_id": 0, "name": 1, "profile_photo": 1, "partner_visibility": 1})
    out = {
        "is_linked": True,
        "role": "owner" if current_user["id"] == owner_id else "partner",
        "partner_name": (other.get("name") if other else None) or "Partner",
        "partner_photo": (other.get("profile_photo") if other else None),
        "linked_since": rel.get("created_at")
    }
    # v49: the hub shows its Journal tab only when the other person
    # shares her journal. The field is PRESENT only when sharing is on;
    # while it is off (the default) the word does not appear here at
    # all, and no journal data of any kind rides along either way.
    if other:
        other_vis = {**DEFAULT_PARTNER_VISIBILITY, **(other.get("partner_visibility") or {})}
        if other_vis.get("share_journal"):
            out["partner_shares_journal"] = True
    return out

def _phase_for_cycle_day(cycle_day: int) -> str:
    """Same day thresholds as calculate_cycle_info, for projecting ahead."""
    if cycle_day <= 5:
        return "menstrual"
    if cycle_day <= 12:
        return "follicular"
    if cycle_day <= 19:
        return "ovulatory"
    return "luteal"


MOOD_LABELS = {1: "Low", 2: "Meh", 3: "Okay", 4: "Good", 5: "Great"}


def _summarize_day_logs(logs):
    """What a day's cycle logs say, in partner-safe summary form:
    feelings (emotion: tags), one mood word (mood: tags), plain symptom
    names, flow, and whether it was a period day. Her log NOTES text is
    never part of a summary: notes are hers alone."""
    feelings, symptoms = [], []
    mood = flow = None
    is_period = False
    for l in logs:
        if l.get("flow"):
            flow = l["flow"]
        if l.get("is_period"):
            is_period = True
        for s in (l.get("symptoms") or []):
            if not isinstance(s, str):
                continue
            if s.startswith("emotion:"):
                name = s.split(":", 1)[1].replace("_", " ").strip()
                if name:
                    feelings.append(name[:1].upper() + name[1:])
            elif s.startswith("mood:"):
                try:
                    mood = MOOD_LABELS.get(int(s.split(":", 1)[1]), mood)
                except ValueError:
                    pass
            elif ":" in s:
                # Prefixed tags (collection:, etc.) are internal detail,
                # not part of a partner summary.
                continue
            else:
                symptoms.append(s)
    return {"feelings": feelings, "mood": mood, "symptoms": symptoms,
            "flow": flow, "is_period": is_period}


async def _log_days_for(user_id: str, include_details: bool, days: int = 28):
    """Feature B (v46): the last `days` calendar days for a user who
    does not track a cycle, built ONLY from her date-keyed cycle logs:
    per date, whether she logged and (when include_details) what she
    logged, as feelings / mood / symptoms / flow. Never notes, never
    journal, vault or intimacy data."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    logs = await db.cycle_logs.find(
        {"user_id": user_id,
         "date": {"$gte": start.isoformat(), "$lte": today.isoformat()}},
        {"_id": 0, "date": 1, "symptoms": 1, "flow": 1, "is_period": 1},
    ).to_list(length=None)
    by_date = {}
    for l in logs:
        by_date.setdefault(l.get("date"), []).append(l)
    out = []
    for i in range(days):
        dstr = (today - timedelta(days=i)).isoformat()
        day_logs = by_date.get(dstr) or []
        entry = {"date": dstr, "logged": bool(day_logs)}
        if include_details and day_logs:
            entry.update(_summarize_day_logs(day_logs))
        out.append(entry)
    return out


async def _mood_today_for(user_id: str):
    """Her overall feeling today as one word, from the mood: tags in
    today's cycle logs (the same coarse signal /partner/calendar uses)."""
    today_str = datetime.now(timezone.utc).date().isoformat()
    logs = await db.cycle_logs.find(
        {"user_id": user_id, "date": today_str},
        {"_id": 0, "symptoms": 1, "created_at": 1},
    ).sort("created_at", 1).to_list(length=None)
    mood = None
    for l in logs:
        for s in (l.get("symptoms") or []):
            if isinstance(s, str) and s.startswith("mood:"):
                try:
                    mood = MOOD_LABELS.get(int(s.split(":", 1)[1]), mood)
                except ValueError:
                    pass
    return mood


def _sync_person(u: dict, is_self: bool, days: int = 28):
    """One person's side of two-cycle sync. Her own side is always full;
    the other person's side only includes what she chose to share."""
    vis = {**DEFAULT_PARTNER_VISIBILITY, **(u.get("partner_visibility") or {})}
    out = {"name": u.get("name") or "Partner", "is_self": is_self, "profile_photo": u.get("profile_photo")}
    lp = u.get("last_period_date")
    status = u.get("cycle_status", "regular")
    if _is_no_periods(u):
        # Feature B (v46): no cycle to project. Her side is her logged
        # days; get_partner_sync attaches them (log_days) and settles
        # the shared flag from her toggles there.
        out["no_periods"] = True
        out["shared"] = True
        out["tracking"] = False
        return out, None
    if not is_self and not vis.get("phase"):
        out["shared"] = False
        return out, None
    out["shared"] = True
    if not lp or status in ("pregnant", "postpartum", "menopause"):
        out["tracking"] = False
        return out, None
    L = int(u.get("cycle_length") or 28)
    info = calculate_cycle_info(lp, L)
    out.update({"tracking": True, "cycle_day": info.get("cycle_day"), "phase": info.get("phase"),
                "cycle_length": L})
    if is_self or vis.get("period_dates"):
        out["next_period_date"] = info.get("next_period_date")
    start = date.fromisoformat(str(lp)[:10])
    today = date.today()
    timeline = []
    for i in range(days):
        d = today + timedelta(days=i)
        cd = ((d - start).days % L) + 1
        timeline.append({"date": d.isoformat(), "cycle_day": cd, "phase": _phase_for_cycle_day(cd)})
    return out, timeline


@api_router.get("/partner/sync")
async def get_partner_sync(current_user: dict = Depends(get_current_user)):
    """Two-cycle syncing: both linked people see each other's phase and day
    side by side for the next 4 weeks, with overlap highlights (same phase
    on the same day, and days you are both on your period). Respects each
    person's partner visibility settings. Never includes journals or
    intimacy logs."""
    rel = await _get_partner_relationship(current_user["id"])
    if not rel:
        raise HTTPException(status_code=403, detail="No linked partner account.")
    owner_id, partner_id = _partner_pair(rel)
    other_id = partner_id if current_user["id"] == owner_id else owner_id
    other = await db.users.find_one({"id": other_id}, {"_id": 0, "password": 0, "email": 0})
    if not other:
        raise HTTPException(status_code=404, detail="Partner account not found")
    me, my_tl = _sync_person(current_user, True)
    them, their_tl = _sync_person(other, False)
    # Feature B (v46): a no_periods side carries her logged days inside
    # her person block (never a new top-level key, never cycle fields).
    # For the other person's side, feelings detail rides on her
    # mood/energy sharing choice, and if she shares neither her days
    # nor her feelings, her side stays private.
    for person, is_self in ((me, True), (them, False)):
        if person.get("no_periods"):
            src = current_user if is_self else other
            svis = {**DEFAULT_PARTNER_VISIBILITY, **(src.get("partner_visibility") or {})}
            if not is_self and not (svis.get("phase") or svis.get("mood_energy")):
                person["shared"] = False
            elif person.get("shared"):
                person["log_days"] = await _log_days_for(
                    src["id"],
                    include_details=is_self or bool(svis.get("mood_energy")))
    days = []
    if my_tl and their_tl:
        for a, b in zip(my_tl, their_tl):
            days.append({
                "date": a["date"],
                "me": {"cycle_day": a["cycle_day"], "phase": a["phase"]},
                "them": {"cycle_day": b["cycle_day"], "phase": b["phase"]},
                "same_phase": a["phase"] == b["phase"],
                "both_period": a["phase"] == "menstrual" and b["phase"] == "menstrual",
            })
    elif my_tl:
        days = [{"date": a["date"], "me": {"cycle_day": a["cycle_day"], "phase": a["phase"]}, "them": None,
                 "same_phase": False, "both_period": False} for a in my_tl]
    elif their_tl:
        # The requester does not track a cycle of their own (e.g. a male
        # partner), but the other person does and shares their phase: build
        # the strip from their timeline so the non-tracking side still sees
        # the full 4 weeks, mirrored from the my_tl branch above.
        days = [{"date": b["date"], "me": None, "them": {"cycle_day": b["cycle_day"], "phase": b["phase"]},
                 "same_phase": False, "both_period": False} for b in their_tl]
    return {
        "me": me,
        "them": them,
        "days": days,
        "overlap_days": sum(1 for d in days if d["same_phase"]),
        "both_period_days": sum(1 for d in days if d["both_period"]),
    }


@api_router.post("/partner/unlink")
async def unlink_partner(current_user: dict = Depends(get_current_user)):
    result = await db.partner_relationships.delete_many({
        "active": True,
        "$or": [{"user_id": current_user["id"]}, {"partner_user_id": current_user["id"]}]
    })
    return {"ok": True, "removed": result.deleted_count}

async def _partner_view_payload(token: str):
    """The data behind the read-only partner view link (v46). Returns
    None when the link is not active. The dict holds ONLY what the
    owner's current visibility choices allow (plus her name and
    picture, which say whose page this is); anything a toggle hides is
    ABSENT here, not just hidden on the page. Journal, vault, intimacy
    data, email and account details are never read for this page.
    The wishlist is always included: it is part of the partner
    experience (Angelita, Oct 26, 2026), whatever the old stored
    toggles say. An empty list simply means she has picked nothing."""
    if not token:
        return None
    invite = await db.partner_invites.find_one({"view_token": token}, {"_id": 0})
    if not invite or invite.get("kind") != "view":
        return None
    if invite.get("status") == "accepted":
        # The link lives only while the relationship does.
        if not await _get_partner_relationship(invite["inviter_id"]):
            return None
    elif invite.get("status") != "pending":
        return None
    owner = await db.users.find_one(
        {"id": invite["inviter_id"]},
        {"_id": 0, "name": 1, "profile_photo": 1, "last_period_date": 1,
         "cycle_length": 1, "cycle_status": 1, "no_periods": 1,
         "partner_visibility": 1})
    if not owner:
        return None
    owner_id = invite["inviter_id"]
    vis = {**DEFAULT_PARTNER_VISIBILITY, **(owner.get("partner_visibility") or {})}
    payload = {"owner_name": owner.get("name") or "Her",
               "owner_photo": owner.get("profile_photo")}
    if _is_no_periods(owner):
        if vis.get("phase") or vis.get("mood_energy"):
            payload["log_days"] = await _log_days_for(
                owner_id, include_details=bool(vis.get("mood_energy")))
        if vis.get("mood_energy"):
            payload["feeling_today"] = await _mood_today_for(owner_id)
    else:
        lp = owner.get("last_period_date")
        if lp:
            info = calculate_cycle_info(lp, int(owner.get("cycle_length") or 28))
            if vis.get("phase"):
                payload["phase"] = info.get("phase")
                payload["cycle_day"] = info.get("cycle_day")
            if vis.get("period_dates"):
                payload["next_period_date"] = info.get("next_period_date")
                payload["days_until_period"] = info.get("days_until_period")
            if vis.get("fertile_window") and owner.get("cycle_status", "regular") not in NO_FERTILITY_STATUSES:
                npd = info.get("next_period_date")
                if npd:
                    ov = date.fromisoformat(str(npd)[:10]) - timedelta(days=14)
                    payload["ovulation_date"] = ov.isoformat()
                    payload["fertile_window"] = {
                        "start": (ov - timedelta(days=5)).isoformat(),
                        "end": ov.isoformat()}
        if vis.get("mood_energy"):
            payload["feeling_today"] = await _mood_today_for(owner_id)
    cursor = db.wishlist_items.find({"user_id": owner_id},
                                    {"_id": 0, "product_id": 1, "created_at": 1})
    docs = await cursor.to_list(length=500)
    docs.sort(key=lambda d: d.get("created_at") or "")
    payload["wishlist"] = [
        {"name": CATALOG_PRODUCTS[d["product_id"]],
         "url": f"https://www.amazon.com/dp/{d['product_id']}?tag=hormoscope20-20"}
        for d in docs if d.get("product_id") in CATALOG_PRODUCTS
    ]
    return payload


_PHASE_TITLES = {
    "menstrual": "Menstrual phase",
    "follicular": "Follicular phase",
    "ovulatory": "Ovulatory phase",
    "luteal": "Luteal phase",
}


def _fmt_view_date(iso):
    try:
        return date.fromisoformat(str(iso)[:10]).strftime("%A, %B %d")
    except (TypeError, ValueError):
        return ""


def _render_partner_view_html(payload):
    """Render the read-only partner view page. Every value that came
    from the owner is escaped. Only keys present in the payload render;
    hidden things leave no trace in the markup."""
    esc = html_lib.escape
    if payload is None:
        body = (
            "<h1>This link is no longer active</h1>"
            "<p class=\"sub\">The person who shared it has turned it off "
            "or replaced it. Ask her for a new link if you would like "
            "to keep following along.</p>"
        )
    else:
        name = esc(str(payload.get("owner_name") or "Her"))
        first = name.split(" ")[0] if name else "Her"
        parts = []
        photo = payload.get("owner_photo")
        if photo:
            parts.append(
                f'<img class="avatar" src="{esc(str(photo), quote=True)}" alt="">')
        parts.append(f"<h1>{name}</h1>")
        parts.append('<p class="sub">Shared with you from her HORMOscope</p>')
        if payload.get("phase"):
            phase_title = _PHASE_TITLES.get(payload["phase"], "Her cycle today")
            day_txt = (f' <span class="dot">&middot;</span> Day {payload["cycle_day"]}'
                       if payload.get("cycle_day") else "")
            parts.append(
                f'<div class="card"><p class="label">Where she is in her cycle</p>'
                f'<p class="big">{esc(phase_title)}{day_txt}</p></div>')
        if payload.get("feeling_today"):
            parts.append(
                f'<div class="card"><p class="label">How she is feeling today</p>'
                f'<p class="big">{esc(str(payload["feeling_today"]))}</p></div>')
        if payload.get("next_period_date"):
            when = _fmt_view_date(payload["next_period_date"])
            du = payload.get("days_until_period")
            du_txt = ""
            if du == 0:
                du_txt = " (estimated to start today)"
            elif du == 1:
                du_txt = " (tomorrow)"
            elif isinstance(du, int) and du > 1:
                du_txt = f" (in {du} days)"
            parts.append(
                f'<div class="card"><p class="label">Her next period is estimated</p>'
                f'<p class="big">{esc(when)}{esc(du_txt)}</p></div>')
        if payload.get("fertile_window"):
            fw = payload["fertile_window"]
            parts.append(
                f'<div class="card"><p class="label">Her fertile window</p>'
                f'<p class="big">{esc(_fmt_view_date(fw.get("start")))} to '
                f'{esc(_fmt_view_date(fw.get("end")))}</p>'
                f'<p class="note">Ovulation estimated around '
                f'{esc(_fmt_view_date(payload.get("ovulation_date")))}</p></div>')
        if payload.get("log_days") is not None:
            rows = []
            for d in payload["log_days"]:
                if not d.get("logged"):
                    continue
                bits = []
                if d.get("feelings"):
                    bits.append("Feeling " + ", ".join(esc(str(f)) for f in d["feelings"]))
                if d.get("mood"):
                    bits.append("Mood: " + esc(str(d["mood"])))
                if d.get("symptoms"):
                    bits.append(esc(", ".join(str(s) for s in d["symptoms"])))
                if d.get("flow"):
                    bits.append("Flow: " + esc(str(d["flow"])))
                if d.get("is_period"):
                    bits.append("Period day")
                rows.append(
                    f'<div class="day"><p class="daydate">{esc(_fmt_view_date(d.get("date")))}</p>'
                    f'<p class="daybody">{" &middot; ".join(bits) if bits else "She logged this day"}</p></div>')
            inner = "".join(rows) if rows else '<p class="note">Nothing logged yet in the last few weeks.</p>'
            parts.append(
                f'<div class="card"><p class="label">Her recent days, from what she logs</p>{inner}</div>')
        wish = payload.get("wishlist")
        if wish is not None:
            if wish:
                items = "".join(
                    f'<div class="wish"><span>{esc(str(w["name"]))}</span>'
                    f'<a href="{esc(str(w["url"]), quote=True)}" target="_blank" rel="noopener">See it on Amazon</a></div>'
                    for w in wish)
            else:
                items = '<p class="note">Nothing picked yet. When she finds pieces she loves, they will be waiting here.</p>'
            parts.append(
                f'<div class="card"><p class="label">{esc(first)}&rsquo;s wishlist</p>{items}'
                f'<p class="fine">As an Amazon Associate I earn from qualifying purchases.</p></div>')
        parts.append(
            '<p class="fine">If you track a cycle too, ask her for a sync '
            'invite so you can follow each other in the app.</p>')
        body = "".join(parts)
    return (
        "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        "<title>HORMOscope</title>"
        "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">"
        "<link href=\"https://fonts.googleapis.com/css2?family=Poiret+One&family=Poppins:wght@300;400;500;600&display=swap\" rel=\"stylesheet\">"
        "<style>"
        "body{margin:0;background:#0B0B1E;color:#EDEDF5;font-family:Poppins,system-ui,sans-serif;}"
        ".wrap{max-width:520px;margin:0 auto;padding:32px 20px 48px;}"
        "h1{font-family:'Poiret One',serif;font-weight:400;font-size:34px;margin:10px 0 4px;color:#fff;}"
        ".sub{color:#B8B8D1;font-size:14px;margin:0 0 22px;}"
        ".avatar{width:76px;height:76px;border-radius:50%;object-fit:cover;border:2px solid #FF4F9A;}"
        ".card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:18px;padding:18px;margin:0 0 14px;}"
        ".label{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#F4A7B9;margin:0 0 8px;}"
        ".big{font-size:20px;margin:0;color:#fff;}"
        ".note{color:#B8B8D1;font-size:13px;margin:8px 0 0;}"
        ".fine{color:#8A87A3;font-size:11px;margin:14px 0 0;line-height:1.6;}"
        ".dot{color:#FF4F9A;}"
        ".day{padding:8px 0;border-top:1px solid rgba(255,255,255,0.06);}"
        ".day:first-of-type{border-top:none;}"
        ".daydate{font-size:12px;color:#F4A7B9;margin:0 0 2px;}"
        ".daybody{font-size:14px;margin:0;color:#EDEDF5;}"
        ".wish{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-top:1px solid rgba(255,255,255,0.06);font-size:14px;}"
        ".wish:first-of-type{border-top:none;}"
        ".wish a{color:#0B0B1E;background:#F4A7B9;padding:7px 12px;border-radius:999px;font-size:12px;text-decoration:none;white-space:nowrap;}"
        "</style></head><body><div class=\"wrap\">"
        + body +
        "</div></body></html>"
    )


@app.get("/partner/view/{token}")
async def partner_view_page(token: str):
    """The read-only partner link page (v46). No account, no login:
    the unguessable token is the key, and it dies the moment she
    revokes it, replaces it, or unlinks."""
    payload = await _partner_view_payload(token)
    return HTMLResponse(_render_partner_view_html(payload))


@api_router.get("/partner/calendar")
async def get_partner_calendar(current_user: dict = Depends(get_current_user)):
    """Her cycle calendar for a linked partner. NEVER includes journal entries
    (intimate or otherwise) or intimacy logs."""
    rel = await _get_partner_relationship(current_user["id"])
    if not rel:
        raise HTTPException(status_code=403, detail="No linked partner account.")
    owner_id, _ = _partner_pair(rel)
    owner = await db.users.find_one({"id": owner_id}, {"_id": 0, "hashed_password": 0, "email": 0})
    if not owner:
        raise HTTPException(status_code=404, detail="Partner account not found")

    last_period = owner.get("last_period_date")
    cycle_length = owner.get("cycle_length", 28)
    period_length = owner.get("period_length", 5)
    if last_period:
        cycle_info = calculate_cycle_info(last_period, cycle_length)
    else:
        cycle_info = {"cycle_day": 1, "cycle_length": 28, "phase": "unknown",
                      "phase_info": "", "next_period_date": None, "days_until_period": None}

    npd = cycle_info.get("next_period_date")
    ovulation_date = fertile_start = fertile_end = None
    _vis = {**DEFAULT_PARTNER_VISIBILITY, **(owner.get("partner_visibility") or {})}
    _share_fertile = _vis.get("fertile_window") and owner.get("cycle_status", "regular") not in NO_FERTILITY_STATUSES
    if npd and _share_fertile:
        np = date.fromisoformat(npd)
        ov = np - timedelta(days=14)
        ovulation_date = ov.isoformat()
        # Fertile window = the 5 days before ovulation plus ovulation day.
        fertile_start = (ov - timedelta(days=5)).isoformat()
        fertile_end = ov.isoformat()

    marked_days = []
    if last_period:
        try:
            lpd = date.fromisoformat(str(last_period)[:10])
            today = date.today()
            win_start = today - timedelta(days=45)
            win_end = today + timedelta(days=75)
            # Project period starts backward then forward across the window
            s = lpd
            while s > win_start - timedelta(days=cycle_length):
                s = s - timedelta(days=cycle_length)
            period_days = set()
            while s <= win_end:
                for i in range(period_length):
                    d = s + timedelta(days=i)
                    if win_start <= d <= win_end:
                        period_days.add(d.isoformat())
                s = s + timedelta(days=cycle_length)
            fertile_days = set()
            if fertile_start and fertile_end:
                f = date.fromisoformat(fertile_start)
                fe = date.fromisoformat(fertile_end)
                while f <= fe:
                    fertile_days.add(f.isoformat())
                    f = f + timedelta(days=1)
            expected_days = set()
            if npd:
                e = date.fromisoformat(npd)
                for i in range(period_length):
                    expected_days.add((e + timedelta(days=i)).isoformat())
            ov_set = {ovulation_date} if ovulation_date else set()
            for ds in sorted(period_days | fertile_days | expected_days | ov_set):
                if ds in period_days:
                    kind = "period"
                elif ds == ovulation_date:
                    kind = "ovulation"
                elif ds in expected_days:
                    kind = "expected_period"
                else:
                    kind = "fertile"
                marked_days.append({"date": ds, "kind": kind})
        except Exception:
            marked_days = []

    phase = cycle_info.get("phase", "menstrual")

    # Her overall feeling today, and nothing more detailed than that
    # (Angelita's Attunement boundary): the coarse mood she last logged
    # today, as one word. Never her notes, her other symptoms, her
    # intimacy logs, or anything from her journal.
    mood_today = None
    today_str = datetime.now(timezone.utc).date().isoformat()
    owner_logs = await db.cycle_logs.find(
        {"user_id": owner_id, "date": today_str}, {"_id": 0, "symptoms": 1, "created_at": 1}
    ).sort("created_at", 1).to_list(length=None)
    mood_labels = {1: "Low", 2: "Meh", 3: "Okay", 4: "Good", 5: "Great"}
    for l in owner_logs:
        for s in (l.get("symptoms") or []):
            if isinstance(s, str) and s.startswith("mood:"):
                try:
                    mood_today = mood_labels.get(int(s.split(":", 1)[1]), mood_today)
                except ValueError:
                    pass

    return {
        "name": owner.get("name", "Her"),
        "profile_photo": owner.get("profile_photo"),
        "cycle_day": cycle_info.get("cycle_day", 1),
        "mood_today": mood_today,
        "cycle_length": cycle_length,
        "phase": phase,
        "phase_info": cycle_info.get("phase_info", ""),
        "next_period_date": npd,
        "days_until_period": cycle_info.get("days_until_period"),
        "ovulation_date": ovulation_date,
        "fertile_window": {"start": fertile_start, "end": fertile_end},
        "marked_days": marked_days,
        "partner_tips": _partner_tips_for_phase(phase)
    }

@api_router.get("/partner/journal")
async def get_partner_journal(current_user: dict = Depends(get_current_user)):
    """Her journal, for her linked in-app partner, ONLY when she turned
    journal sharing on (partner_visibility.share_journal, v49). While
    the choice is off (the default for everyone) this refuses, and no
    journal data appears in any partner payload. Entries she marked
    intimate are never served here either way: those are her eyes only,
    a separate promise from sharing. Read-only; nothing here writes.
    View links never carry journal entries, whatever she chooses."""
    rel = await _get_partner_relationship(current_user["id"])
    if not rel:
        raise HTTPException(status_code=403, detail="No linked partner account.")
    owner_id, partner_id = _partner_pair(rel)
    other_id = partner_id if current_user["id"] == owner_id else owner_id
    other = await db.users.find_one({"id": other_id}, {"_id": 0, "name": 1, "partner_visibility": 1})
    if not other:
        raise HTTPException(status_code=404, detail="Partner account not found")
    other_vis = {**DEFAULT_PARTNER_VISIBILITY, **(other.get("partner_visibility") or {})}
    if not other_vis.get("share_journal"):
        raise HTTPException(status_code=403, detail="Journal sharing is off.")
    entries = await db.journal_entries.find(
        {"user_id": other_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    by_day = {}
    for e in entries:
        if e.get("is_intimate"):
            continue
        d = _journal_day(e.get("created_at"))
        if d is None:
            continue
        by_day.setdefault(d.isoformat(), []).append({
            "id": e.get("id"),
            "title": e.get("title") or "",
            "content": e.get("content") or "",
            "created_at": e.get("created_at"),
        })
    days = [{"date": d, "entries": by_day[d]} for d in sorted(by_day, reverse=True)]
    return {"partner_name": other.get("name") or "Partner", "days": days}

# ==================== ATTUNED PARTNER MODE: NOTES ====================
# A quiet, unadvertised space where the two of them can leave short notes
# for each other. Not mentioned in onboarding or UI tours — discovered
# naturally inside partner mode.

@api_router.post("/partner/notes")
async def create_partner_note(note: PartnerNoteCreate, current_user: dict = Depends(get_current_user)):
    rel = await _get_partner_relationship(current_user["id"])
    if not rel:
        raise HTTPException(status_code=403, detail="No linked partner account.")
    content = (note.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Note can't be empty.")
    if len(content) > 280:
        raise HTTPException(status_code=400, detail="Keep notes under 280 characters.")
    owner_id, partner_id = _partner_pair(rel)
    note_data = {
        "id": str(uuid.uuid4()),
        "author_id": current_user["id"],
        "author_name": current_user.get("name") or "Her",
        "recipient_id": partner_id if current_user["id"] == owner_id else owner_id,
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    await db.partner_notes.insert_one(note_data)
    return {"id": note_data["id"], "message": "Note sent"}

@api_router.get("/partner/notes")
async def get_partner_notes(current_user: dict = Depends(get_current_user)):
    rel = await _get_partner_relationship(current_user["id"])
    if not rel:
        raise HTTPException(status_code=403, detail="No linked partner account.")
    owner_id, partner_id = _partner_pair(rel)
    notes = await db.partner_notes.find(
        {"$or": [
            {"author_id": owner_id, "recipient_id": partner_id},
            {"author_id": partner_id, "recipient_id": owner_id}
        ]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(length=500)
    unread = sum(1 for n in notes if n["recipient_id"] == current_user["id"] and not n.get("read"))
    return {"notes": notes, "unread_count": unread}

@api_router.put("/partner/notes/read")
async def mark_partner_notes_read(current_user: dict = Depends(get_current_user)):
    rel = await _get_partner_relationship(current_user["id"])
    if not rel:
        raise HTTPException(status_code=403, detail="No linked partner account.")
    result = await db.partner_notes.update_many(
        {"recipient_id": current_user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"ok": True, "marked": result.modified_count}

@api_router.delete("/partner/notes/{note_id}")
async def delete_partner_note(note_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.partner_notes.delete_one({"id": note_id, "author_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted"}

# ==================== ATTUNED PARTNER MODE: MOOD LOGGING ====================
# Two way attunement: each linked person logs how they feel today, and
# the other person can see that log. Only partner_mood_logs are read
# here. Never journal entries, cycle logs, or intimacy data.

PARTNER_MOOD_LABELS = {1: "Low", 2: "Meh", 3: "Okay", 4: "Good", 5: "Great"}

@api_router.post("/partner/mood")
async def create_partner_mood(payload: PartnerMoodCreate, current_user: dict = Depends(get_current_user)):
    rel = await _get_partner_relationship(current_user["id"])
    if not rel:
        raise HTTPException(status_code=403, detail="No linked partner account.")
    mood = payload.mood
    if mood is not None and mood not in PARTNER_MOOD_LABELS:
        raise HTTPException(status_code=400, detail="Mood must be between 1 and 5.")
    raw_feelings = payload.feelings or []
    if len(raw_feelings) > 12:
        raise HTTPException(status_code=400, detail="Pick up to 12 feelings.")
    feelings = []
    for f in raw_feelings:
        if not isinstance(f, str):
            raise HTTPException(status_code=400, detail="Feelings must be text.")
        cleaned = f.strip()[:40]
        if cleaned:
            feelings.append(cleaned)
    if mood is None and not feelings:
        raise HTTPException(status_code=400, detail="Pick a mood or at least one feeling.")
    owner_id, partner_id = _partner_pair(rel)
    recipient_id = partner_id if current_user["id"] == owner_id else owner_id
    today_str = datetime.now(timezone.utc).date().isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()
    existing = await db.partner_mood_logs.find_one(
        {"author_id": current_user["id"], "date": today_str}, {"_id": 0}
    )
    if existing:
        await db.partner_mood_logs.update_one(
            {"author_id": current_user["id"], "date": today_str},
            {"$set": {
                "author_name": current_user.get("name") or "Partner",
                "recipient_id": recipient_id,
                "mood": mood,
                "mood_label": PARTNER_MOOD_LABELS.get(mood) if mood is not None else None,
                "feelings": feelings,
                "updated_at": now_iso,
            }}
        )
        saved = await db.partner_mood_logs.find_one(
            {"author_id": current_user["id"], "date": today_str}, {"_id": 0}
        )
        return saved
    doc = {
        "id": str(uuid.uuid4()),
        "author_id": current_user["id"],
        "author_name": current_user.get("name") or "Partner",
        "recipient_id": recipient_id,
        "date": today_str,
        "mood": mood,
        "mood_label": PARTNER_MOOD_LABELS.get(mood) if mood is not None else None,
        "feelings": feelings,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.partner_mood_logs.insert_one(dict(doc))
    return doc

@api_router.get("/partner/mood")
async def get_partner_mood(current_user: dict = Depends(get_current_user)):
    rel = await _get_partner_relationship(current_user["id"])
    if not rel:
        raise HTTPException(status_code=403, detail="No linked partner account.")
    owner_id, partner_id = _partner_pair(rel)
    other_id = partner_id if current_user["id"] == owner_id else owner_id
    other = await db.users.find_one({"id": other_id}, {"_id": 0, "name": 1, "profile_photo": 1})
    partner_name = (other.get("name") if other else None) or "Partner"
    partner_photo = (other.get("profile_photo") if other else None)
    today_str = datetime.now(timezone.utc).date().isoformat()
    mine_today = await db.partner_mood_logs.find_one(
        {"author_id": current_user["id"], "date": today_str}, {"_id": 0}
    )
    theirs_today = await db.partner_mood_logs.find_one(
        {"author_id": other_id, "date": today_str}, {"_id": 0}
    )
    return {"mine_today": mine_today, "theirs_today": theirs_today, "partner_name": partner_name, "partner_photo": partner_photo}


# ==================== ATTUNED GIFTS: WISHLIST / BOUTIQUE ====================
# Angelita's curated Amazon catalog (Oct 25, 2026): the picks live in the
# app as a fixed ASIN list, and this is the server copy of that list.
# Picks are validated against it, so the boutique can only ever hold
# catalog items. A user's picks are her boutique: private by default,
# and a linked partner can see them only when she shares (below).

CATALOG_PRODUCT_IDS = {
    # One single flat list (Angelita, Oct 26, 2026); no collections.
    "B0FHBXCCLM", "B0C1YG33PD", "B0C9LCM3HW", "B07NLSLP9K", "B093LVS21D", "B083C6BYG9",
    "B0FGB2NS3C", "B07M5X4D3P",
    "B0CNC67C8B",
    "B07VTDXFDC", "B0D7N2KWLH", "B09Y8SV5RY",
    "B0F8J3GJDQ", "B0FY7R1TQ3",
    "B0FQFMDMDC", "B0B75T46L8",
    # Added Oct 26, 2026, in the order she sent them.
    "B0BX78DC84", "B0BLSVBMVY", "B0DS1MRGBY", "B00LWE69NU", "B07YQBWVGF", "B06XKP5Z1X",
    "B07JK78TM7", "B0DZ2J1GS1", "B09PTGQ4CK", "B0CFPRZHYM", "B005F1ATJQ",
}


class WishlistAdd(BaseModel):
    product_id: str


@api_router.get("/wishlist")
async def get_wishlist(current_user: dict = Depends(get_current_user)):
    cursor = db.wishlist_items.find({"user_id": current_user["id"]}, {"_id": 0})
    docs = await cursor.to_list(length=500)
    docs.sort(key=lambda d: d.get("created_at") or "")
    return {"items": docs}


@api_router.post("/wishlist")
async def add_wishlist_item(payload: WishlistAdd, current_user: dict = Depends(get_current_user)):
    pid = (payload.product_id or "").strip()
    if pid not in CATALOG_PRODUCT_IDS:
        raise HTTPException(status_code=400, detail="That item is not in the catalog.")
    existing = await db.wishlist_items.find_one(
        {"user_id": current_user["id"], "product_id": pid}, {"_id": 0}
    )
    if existing:
        return existing
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "product_id": pid,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wishlist_items.insert_one(dict(doc))
    return doc


@api_router.delete("/wishlist/{product_id}")
async def remove_wishlist_item(product_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.wishlist_items.delete_many(
        {"user_id": current_user["id"], "product_id": product_id}
    )
    return {"ok": True, "removed": result.deleted_count}


# Names for the server-rendered partner link view's wishlist section.
# Mirrors frontend/src/data/catalog.js (same picks; links are built
# with her Associates tag, hormoscope20-20).
CATALOG_PRODUCTS = {
    "B0FHBXCCLM": "Dona Tea Library",
    "B0C1YG33PD": "BouZaFoFa Portable Heating Pad for Cramps",
    "B0C9LCM3HW": "FLEX Reusable Menstrual Disc Starter Bundle",
    "B07NLSLP9K": "Always Radiant Pads, Size 5 Extra Heavy Overnight, 54 Count",
    "B093LVS21D": "Tampax Pearl Tampons, Regular, 50 Count x 2",
    "B083C6BYG9": "Rael Slim Applicator Tampons, Organic Cotton, 40 Count",
    "B0FGB2NS3C": "Philips Lumea 9000 Series IPL Hair Removal Device",
    "B07M5X4D3P": "iRESTORE Professional Laser Hair Growth System",
    "B0CNC67C8B": "Diamond Tennis Bracelet, 20 Carat Lab Grown, Platinum, 7 Inch",
    "B07VTDXFDC": "Aromatherapy Associates Ultimate Wellbeing Bath & Shower Oil Set",
    "B0D7N2KWLH": "iRestore LED Face Mask",
    "B09Y8SV5RY": "KARMAPLEDGE Chakra Tree of Life",
    "B0F8J3GJDQ": "Survival Kit Advent Calendar for Men",
    "B0FY7R1TQ3": "LOVERY Luxury Perfume Advent Calendar for Women",
    "B0FQFMDMDC": "Evvy Vaginal Health Test, 2 Pack",
    "B0B75T46L8": "Viome Full Body Intelligence Test",
    "B0BX78DC84": "Pixie Menstrual Cup & Disc Boiler Sterilizer",
    "B0BLSVBMVY": "Pixie Menstrual Disc Kit",
    "B0DS1MRGBY": "Pixie Disc + Applicator Bundle (2 discs)",
    "B00LWE69NU": "Flex Reusable Disc",
    "B07YQBWVGF": "Cora Overnight Pads, 72 count",
    "B06XKP5Z1X": "Cora Organic Tampons, 36 Super",
    "B07JK78TM7": "Cora Organic Tampons Multipack, 36 count",
    "B0DZ2J1GS1": "Comfytemp Cordless Heating Belt",
    "B09PTGQ4CK": "Menstruation Crustacean Lobster Heating Plush",
    "B0CFPRZHYM": "OQQ 3 Piece Bodysuits",
    "B005F1ATJQ": "Ancient Minerals Magnesium Bath Flakes",
}


@api_router.get("/partner/wishlist")
async def get_partner_wishlist(current_user: dict = Depends(get_current_user)):
    """Your partner's wishlist, inside your Attunement gift section.
    The wishlist is always part of the partner experience (Angelita,
    Oct 26, 2026): a linked partner sees her picks whatever the stored
    "My wishlist" toggle or boutique visibility say. Those fields stay
    stored but no longer gate this view; her real control is the
    contents. No picks, an empty list. Returns product ids only (the
    catalog names and copy live in the app), plus her name and picture
    so the wishlist carries her face, as she asked."""
    rel = await _get_partner_relationship(current_user["id"])
    if not rel:
        raise HTTPException(status_code=403, detail="No linked partner account.")
    owner_id, partner_id = _partner_pair(rel)
    other_id = partner_id if current_user["id"] == owner_id else owner_id
    other = await db.users.find_one({"id": other_id}, {"_id": 0})
    if not other:
        raise HTTPException(status_code=404, detail="Partner account not found")
    boutique_vis = other.get("boutique_visibility") or "private"
    cursor = db.wishlist_items.find({"user_id": other_id}, {"_id": 0})
    docs = await cursor.to_list(length=500)
    docs.sort(key=lambda d: d.get("created_at") or "")
    return {
        "partner_name": other.get("name") or "Partner",
        "partner_photo": other.get("profile_photo"),
        "boutique_visibility": boutique_vis,
        "items": docs,
    }


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
    # Image feature requires premium (for both modes)
    if msg.image_base64 and not current_user.get("is_premium", False):
        raise HTTPException(status_code=403, detail="Image feature requires premium subscription")
    
    # Daily cap for accounts without premium or companion access.
    if not (current_user.get("is_premium") or _companion_access(current_user)["has_access"]):
        used_today = await db.chat_messages.count_documents(
            {"user_id": current_user["id"], "timestamp": {"$gte": _utc_day_start_iso()}}
        )
        if used_today >= CHAT_FREE_DAILY_LIMIT:
            raise HTTPException(
                status_code=402,
                detail=f"You've used today's {CHAT_FREE_DAILY_LIMIT} free AI messages. They come back tomorrow.",
            )

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
    
    user_name = current_user.get("name", "beautiful")

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
            "has_image": bool(msg.image_base64),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.chat_messages.insert_one(chat_record)
        
        return ChatMessageResponse(
            id=chat_record["id"],
            user_message=msg.message if msg.message else "[Photo]",
            ai_response=response,
            timestamp=chat_record["timestamp"],
            conversation_id=conversation_id,
            has_image=bool(msg.image_base64)
        )
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

@api_router.get("/chat/history")
async def get_chat_history(conversation_id: str = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if conversation_id:
        query["conversation_id"] = conversation_id
    messages = await db.chat_messages.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).to_list(50)
    return messages[::-1]  # Return in chronological order

@api_router.get("/chat/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    """Get list of conversations for sidebar"""
    conversations = await db.conversations.find(
        {"user_id": current_user["id"]},
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

# Advanced Insights endpoint removed (Angelita, Oct 18, 2026).
# The shared /cycle-stats endpoint used by Calendar is elsewhere and stays.

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
            "url": "/"
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

# CORS: only the origins listed in CORS_ORIGINS (comma separated) may call
# the API from a browser. No wildcard default. The Capacitor Android app
# loads from https://localhost / capacitor://localhost, which are included.
_cors_origins = [o.strip() for o in os.environ.get(
    'CORS_ORIGINS', 'https://localhost,capacitor://localhost,http://localhost'
).split(',') if o.strip() and o.strip() != '*']
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
