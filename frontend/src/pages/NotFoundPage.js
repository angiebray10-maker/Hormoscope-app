import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Moon } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#05050A] stars-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#ff8fab] to-[#ffc2d1] flex items-center justify-center mb-6 gold-glow">
        <Moon className="w-12 h-12 text-[#05050A]" />
      </div>
      
      <h1 className="text-6xl font-bold text-[#ff8fab] mb-4" >
        404
      </h1>
      
      <h2 className="text-2xl font-semibold text-[#F5F5F5] mb-4" >
        Page Not Found
      </h2>
      
      <p className="text-[#A0A0A0] mb-8 max-w-sm">
        Oops! This page seems to have wandered off during its luteal phase. Let's get you back home.
      </p>

      <p className="text-[#505050] mb-6">
        Redirecting in {countdown} seconds...
      </p>

      <Link to="/">
        <Button className="btn-gold flex items-center gap-2">
          <Home className="w-5 h-5" />
          Go Home Now
        </Button>
      </Link>
    </div>
  );
}
