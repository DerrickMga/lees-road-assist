import Link from 'next/link';

const SERVICES = [
  { icon: '🔋', title: 'Battery Jump Start', desc: 'Dead battery? We dispatch a technician to you in minutes.' },
  { icon: '🔧', title: 'Tyre Change', desc: 'Flat tyre? Our crew carry spares and handle the swap on-site.' },
  { icon: '🚗', title: 'Tow Service', desc: 'Vehicle breakdown or accident — we tow you to safety fast.' },
  { icon: '⛽', title: 'Fuel Delivery', desc: 'Ran out of fuel? We bring it straight to your location.' },
  { icon: '🔑', title: 'Lockout Rescue', desc: 'Locked out? Our technicians open your vehicle without damage.' },
  { icon: '🛠️', title: 'On-Site Repairs', desc: 'Minor mechanical issues fixed right where you are.' },
];

const STEPS = [
  { n: '01', title: 'Request Help', desc: 'Open the app or web portal and describe your issue in seconds.' },
  { n: '02', title: 'Get Matched', desc: 'We dispatch the nearest qualified provider to your GPS location.' },
  { n: '03', title: 'Track Live', desc: 'Watch your provider arrive in real time — no guessing.' },
  { n: '04', title: 'Back on the Road', desc: 'Job done, you pay through the app and rate your experience.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Lee's Road Assist" className="h-8 w-auto" />
            <span className="font-bold text-gray-900 text-lg hidden sm:block">Lee&apos;s Road Assist</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5">
              Sign In
            </Link>
            <Link href="/login" className="text-sm font-semibold bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-green-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-36 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-green-400 mb-4">
              Zimbabwe&apos;s #1 Roadside Assistance
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              Stranded?<br />
              <span className="text-green-400">Help is minutes away.</span>
            </h1>
            <p className="text-gray-300 text-lg mb-8 max-w-md">
              Lee&apos;s Road Assist connects you with certified roadside technicians across Zimbabwe — 24/7, on demand.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="bg-green-500 hover:bg-green-400 text-white font-bold px-8 py-3 rounded-xl transition-colors text-sm"
              >
                Request Assistance →
              </Link>
              <a
                href="#how-it-works"
                className="border border-white/30 hover:border-white/60 text-white font-medium px-8 py-3 rounded-xl transition-colors text-sm"
              >
                How it works
              </a>
            </div>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="relative w-72 h-72 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <div className="text-9xl">🚗</div>
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-2xl shadow-xl">🔧</div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-2xl shadow-xl">⚡</div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: '< 15 min', label: 'Average response time' },
            { value: '24/7', label: 'Always available' },
            { value: '100+', label: 'Certified providers' },
            { value: 'Zimbabwe-wide', label: 'Coverage area' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-extrabold text-green-600">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">Everything you need, roadside</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">From a flat tyre to a full tow, our network of providers has you covered.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s) => (
              <div key={s.title} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{s.icon}</div>
                <h3 className="font-bold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">How it works</h2>
            <p className="text-gray-500 mt-3">Four simple steps from breakdown to back on the road.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 font-extrabold text-xl flex items-center justify-center mx-auto mb-4">
                  {s.n}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-green-600 text-white py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Ready when you need us most</h2>
          <p className="text-green-100 text-lg mb-8">
            Create a free account and get roadside help dispatched to you in under 15 minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="bg-white text-green-700 font-bold px-8 py-3 rounded-xl hover:bg-green-50 transition-colors text-sm"
            >
              Sign In / Register →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-6 w-auto opacity-60" />
            <span>Lee&apos;s Road Assist &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
            <span className="text-gray-600">|</span>
            <span>24/7 Hotline: <span className="text-white">+263 77 100 0000</span></span>
          </div>
        </div>
      </footer>
    </div>
  );
}



