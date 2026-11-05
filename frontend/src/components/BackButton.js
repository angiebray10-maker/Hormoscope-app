import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// One shared back arrow for every page (Angelita, Nov 5, 2026):
// it goes back to the actual last page she was on inside the app,
// never out of the app. If there is no in-app history to go back
// to (she landed here directly), it falls back to the given page.
export default function BackButton({ fallback = '/profile', label = 'Back', className = '' }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallback);
  };
  return (
    <button
      type="button"
      onClick={goBack}
      data-testid="back-btn"
      className={`inline-flex items-center gap-1 text-[#E6E0EE] hover:text-white text-sm ${className}`}
    >
      <ChevronLeft className="w-5 h-5" />
      {label}
    </button>
  );
}
