import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const LOGO_URL = "/logo192.png";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#05050A] p-6 pb-24">
      <Link to="/profile" className="inline-flex items-center gap-2 text-[#b8b8d1] hover:text-white mb-8">
        <ChevronLeft className="w-5 h-5" />
        Back
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-14 h-14 rounded-full bg-[#1a1a2e] flex items-center justify-center overflow-hidden">
          <img src={LOGO_URL} alt="horMoscope" className="w-16 h-16 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-[#F5F5F5]" >
          Terms of Service
        </h1>
      </div>

      <div className="glass-card p-6 space-y-6 text-[#A0A0A0]">
        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Welcome to HORMOscope
          </h2>
          <p>
            By using our app, you agree to these terms. Please read them carefully before creating an account or using our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Service Description
          </h2>
          <p>
            HORMOscope is a menstrual cycle tracking application that provides:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>Period and cycle tracking</li>
            <li>Personalized wellness coaching</li>
            <li>Hormone insights and predictions</li>
            <li>Personal journaling and intimacy tracking</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Not Medical Advice
          </h2>
          <p>
            HORMOscope is not a medical device and does not provide medical advice. 
            Our predictions and insights are for informational purposes only and should not replace professional medical consultation. 
            Always consult a healthcare provider for medical concerns.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            User Responsibilities
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>You must be 18 years or older to use this service</li>
            <li>You are responsible for maintaining the security of your account</li>
            <li>You agree to provide accurate information</li>
            <li>You will not misuse the app features</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Premium Subscription
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Premium subscription is billed monthly at $4.99 USD</li>
            <li>You can cancel your subscription at any time</li>
            <li>Refunds are handled on a case-by-case basis</li>
            <li>Premium features are available immediately upon payment</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Content & Features
          </h2>
          <p>
            Our wellness content and coaching features are designed to be supportive and helpful. 
            While we strive for accuracy, responses and predictions may not always be perfect. 
            Our content should not replace professional medical advice or support.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Termination
          </h2>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms or engage in harmful behavior.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Contact
          </h2>
          <p>
            For questions about these terms, please contact us at legal@hormoscope.app
          </p>
        </section>

        <p className="text-[#505050] text-sm pt-4 border-t border-[#12121A]">
          Last updated: December 2025
        </p>
      </div>
    </div>
  );
}
