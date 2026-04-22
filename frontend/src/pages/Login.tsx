import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Email ou mot de passe incorrect');
        } else {
          setError(error.message);
        }
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-theme-primary min-h-screen text-theme-text font-display overflow-x-hidden">
      <Navbar />

      <div className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-br from-white/10 via-gray-300/10 to-gray-400/10 blur-[100px] rounded-full pointer-events-none opacity-50"></div>

        <div className="max-w-md w-full mx-auto relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold gradient-text mb-3">Connexion</h1>
            <p className="text-gray-400">Connectez-vous à votre compte</p>
          </div>

          <div className="glass-panel rounded-2xl p-8 border border-white/10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

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
                  className="w-full px-4 py-3 bg-theme-tertiary border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  placeholder="vous@exemple.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-theme-tertiary border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mr-2 rounded border-white/10 bg-theme-tertiary text-primary focus:ring-primary"
                  />
                  Se souvenir de moi
                </label>
                <Link to="/forgot-password" className="text-primary hover:text-primary-hover transition">
                  Mot de passe oublié ?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full silver-gradient-cta disabled:opacity-50 disabled:cursor-not-allowed font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    Connexion...
                  </>
                ) : (
                  <>
                    <LogIn size={20} />
                    Se connecter
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Pas encore de compte ?{' '}
                <Link to="/register" className="text-primary hover:text-primary-hover font-semibold transition">
                  Créer un compte
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="text-gray-500 hover:text-gray-400 text-sm transition">
              ← Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
