import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';
import { getGuestToken } from '../lib/api';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const hasGuestSession = Boolean(getGuestToken());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);

    try {
      const { error: err } = await signUp(email, password, fullName, 'professional');
      if (err) {
        setError(err.message);
        return;
      }
      navigate('/dashboard');
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-theme-primary min-h-screen text-theme-text font-display overflow-x-hidden">
      <Navbar />

      <div className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-br from-white/10 via-gray-300/10 to-gray-400/10 blur-[100px] rounded-full pointer-events-none opacity-50" />

        <div className="max-w-md w-full mx-auto relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold gradient-text mb-3">Créer un compte</h1>
            <p className="text-gray-400">
              Accédez à vos refontes et projets Imager depuis n&apos;importe quel appareil.
            </p>
            {hasGuestSession && (
              <p className="text-sm text-emerald-400/90 mt-3">
                Vos créations en mode invité seront rattachées à ce compte après inscription.
              </p>
            )}
          </div>

          <div className="glass-panel rounded-2xl p-8 border border-white/10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-2">
                  Nom complet
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full px-4 py-3 bg-theme-tertiary border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  placeholder="Jean Dupont"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 bg-theme-tertiary border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  placeholder="vous@entreprise.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Mot de passe (6 caractères minimum)
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 bg-theme-tertiary border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full silver-gradient-cta disabled:opacity-50 disabled:cursor-not-allowed font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    Inscription...
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    S&apos;inscrire
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-primary hover:text-primary-hover font-semibold transition">
                  Se connecter
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="text-gray-500 hover:text-gray-400 text-sm transition">
              ← Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
