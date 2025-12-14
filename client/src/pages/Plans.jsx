import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import NotificationContext from '../context/NotificationContext';

const Plans = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useContext(AuthContext);
    const { showNotification } = useContext(NotificationContext);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/plans');
                setPlans(res.data);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching plans:', error);
                setLoading(false);
                showNotification('Failed to load plans', 'error');
            }
        };

        fetchPlans();

        // Load Razorpay script
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const handleSubscribe = async (planId) => {
        if (!user) {
            navigate('/login');
            return;
        }

        try {
            const config = {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            };

            // 1. Create Order
            const { data: orderData } = await axios.post(
                'http://localhost:5000/api/subscriptions',
                { planId },
                config
            );

            // 2. Open Razorpay Checkout
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder', // Should come from env
                amount: orderData.amount,
                currency: orderData.currency,
                name: "Payal's Kitchen",
                description: "Subscription Payment",
                order_id: orderData.orderId,
                handler: async function (response) {
                    try {
                        // 3. Verify Payment
                        await axios.post(
                            'http://localhost:5000/api/subscriptions/verify',
                            {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                planId: planId,
                            },
                            config
                        );
                        showNotification('Subscription successful! Redirecting to your orders...', 'success');
                        navigate('/orders');
                    } catch (error) {
                        console.error('Payment verification failed:', error);
                        showNotification('Payment verification failed. Please contact support.', 'error');
                    }
                },
                prefill: {
                    name: user.name,
                    email: user.email,
                },
                theme: {
                    color: '#ea580c',
                },
            };

            const rzp1 = new window.Razorpay(options);
            rzp1.on('payment.failed', function (response) {
                showNotification(response.error.description, 'error');
            });
            rzp1.open();

        } catch (error) {
            console.error('Error initiating subscription:', error);
            showNotification('Failed to initiate subscription. Please try again.', 'error');
        }
    };

    if (loading) {
        return <div className="text-center py-10">Loading plans...</div>;
    }

    // Filter and sort plans
    const monthlyPlans = plans
        .filter(plan => plan.duration === 'monthly')
        .sort((a, b) => a.price - b.price);

    const yearlyPlans = plans
        .filter(plan => plan.duration === 'yearly')
        .sort((a, b) => a.price - b.price);

    const PlanCard = ({ plan }) => (
        <div key={plan._id} className="border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200 bg-white flex flex-col hover:shadow-lg transition-shadow duration-300">
            <div className="p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">{plan.name}</h3>
                <p className="mt-4 text-sm text-gray-500">{plan.description}</p>
                <p className="mt-8">
                    <span className="text-4xl font-extrabold text-gray-900">₹{plan.price}</span>
                    <span className="text-base font-medium text-gray-500">/{plan.duration}</span>
                </p>
                <button
                    type="button"
                    onClick={() => handleSubscribe(plan._id)}
                    className="mt-8 block w-full bg-orange-600 border border-transparent rounded-md py-2 text-sm font-semibold text-white text-center hover:bg-orange-700 transition-colors duration-200"
                >
                    Subscribe Now
                </button>
            </div>
            <div className="pt-6 pb-8 px-6 flex-grow">
                <h4 className="text-sm font-medium text-gray-900 tracking-wide uppercase">What's included</h4>
                <ul className="mt-6 space-y-4">
                    {plan.features.map((feature, index) => (
                        <li key={index} className="flex space-x-3">
                            <Check className="flex-shrink-0 h-5 w-5 text-green-500" aria-hidden="true" />
                            <span className="text-sm text-gray-500">{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );

    return (
        <div className="bg-gray-50 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                        Choose Your Plan
                    </h2>
                    <p className="mt-4 text-xl text-gray-500">
                        Flexible subscription options tailored to your needs.
                    </p>
                </div>

                {/* Monthly Plans Section */}
                <div className="mb-16">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-2 border-gray-200">Monthly Plans</h3>
                    <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-3">
                        {monthlyPlans.map(plan => <PlanCard key={plan._id} plan={plan} />)}
                    </div>
                </div>

                {/* Yearly Plans Section */}
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-2 border-gray-200">Yearly Plans <span className="text-sm font-normal text-green-600 ml-2">(Best Value: 2 Months Free!)</span></h3>
                    <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-3">
                        {yearlyPlans.map(plan => <PlanCard key={plan._id} plan={plan} />)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Plans;
