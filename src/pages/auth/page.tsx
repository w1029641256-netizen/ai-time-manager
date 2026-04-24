import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signUp } from '@/utils/auth';

const AuthPage = () => {
    const navigate = useNavigate();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async () => {
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }

        const result =
            mode === 'login'
                ? await signIn(email, password)
                : await signUp(email, password);

        if (result.error) {
            alert(result.error.message);
            return;
        }

        alert(mode === 'login' ? 'Login successful' : 'Account created');
        sessionStorage.setItem('just_logged_in', 'true');
        navigate('/plan');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center px-6">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-gray-100">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                        <i className="ri-user-line text-3xl text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900">
                        {mode === 'login' ? 'Login' : 'Create Account'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Sync your plans across devices
                    </p>
                </div>

                <div className="space-y-3">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />

                    <button
                        onClick={handleSubmit}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold"
                    >
                        {mode === 'login' ? 'Login' : 'Register'}
                    </button>

                    <button
                        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                        className="w-full py-3 text-sm text-violet-600 font-semibold"
                    >
                        {mode === 'login'
                            ? 'No account? Register'
                            : 'Already have an account? Login'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;