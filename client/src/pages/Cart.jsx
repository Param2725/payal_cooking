import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import NotificationContext from '../context/NotificationContext';
import axios from 'axios';
import { Trash2, Plus, Minus } from 'lucide-react';

const Cart = () => {
    const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart } = useContext(CartContext);
    const { user } = useContext(AuthContext);
    const { showNotification } = useContext(NotificationContext);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Load Razorpay script
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const handleCheckout = async () => {
        if (!user) {
            navigate('/login');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const totalAmount = getCartTotal();

            // 1. Create Razorpay Order
            const config = {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            };

            const { data: orderData } = await axios.post(
                'http://localhost:5000/api/orders/razorpay',
                { amount: totalAmount },
                config
            );

            // 2. Open Razorpay Checkout
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
                amount: orderData.amount,
                currency: orderData.currency,
                name: "Payal's Kitchen",
                description: "Order Payment",
                order_id: orderData.id,
                handler: async function (response) {
                    try {
                        // 3. Verify Payment
                        await axios.post(
                            'http://localhost:5000/api/orders/verify',
                            {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            },
                            config
                        );

                        // 4. Create Database Order
                        const hasEvent = cartItems.some(item => item.type === 'event');
                        const orderType = hasEvent ? 'event' : 'single';

                        const dbOrderItems = cartItems.map(item => {
                            if (item.type === 'event') {
                                return {
                                    name: `Event Catering (${item.guestCount} Guests)`,
                                    quantity: 1,
                                    price: item.totalAmount,
                                    selectedItems: item.items.map(i => i.name)
                                };
                            } else if (item.type === 'single_tiffin') {
                                return {
                                    name: item.name,
                                    quantity: item.quantity,
                                    price: item.totalAmount,
                                    selectedItems: item.menuItems,
                                    mealTime: item.mealTime
                                };
                            } else {
                                return {
                                    name: item.name,
                                    quantity: item.quantity,
                                    price: item.price
                                };
                            }
                        });

                        let deliveryDate = new Date();
                        const itemWithDate = cartItems.find(item => item.deliveryDate);
                        if (itemWithDate) {
                            deliveryDate = new Date(itemWithDate.deliveryDate);
                        } else {
                            deliveryDate.setDate(deliveryDate.getDate() + 1);
                        }

                        const finalOrderData = {
                            items: dbOrderItems,
                            totalAmount: totalAmount,
                            type: orderType,
                            deliveryDate: deliveryDate,
                            deliveryAddress: user.address || { street: '123 Main St', city: 'City', zip: '12345' },
                            paymentId: response.razorpay_payment_id,
                            paymentStatus: 'Paid'
                        };

                        await axios.post('http://localhost:5000/api/orders', finalOrderData, config);

                        clearCart();
                        showNotification('Order placed successfully!', 'success');
                        navigate('/orders');

                    } catch (error) {
                        console.error('Order creation failed:', error);
                        const errorMessage = error.response?.data?.message || 'Payment verification or Order creation failed. Please contact support.';
                        showNotification(errorMessage, 'error');
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

        } catch (err) {
            console.error('Checkout error:', err);
            setError(err.response?.data?.message || 'Checkout failed');
            showNotification(err.response?.data?.message || 'Checkout failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (cartItems.length === 0) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-gray-900">Your cart is empty</h2>
                <p className="mt-4 text-gray-500">Add some delicious meals to get started.</p>
            </div>
        );
    }

    return (
        <div className="bg-white py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-3xl font-extrabold text-gray-900 mb-8">Shopping Cart</h2>

                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

                <div className="flex flex-col lg:flex-row gap-12">
                    <div className="lg:w-2/3">
                        <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
                            <ul className="divide-y divide-gray-200">
                                {cartItems.map((item, index) => (
                                    <li key={index} className="p-6 flex items-center justify-between">
                                        <div className="flex items-center w-full">
                                            <div className="ml-4 flex-1">
                                                {item.type === 'event' ? (
                                                    <div>
                                                        <h3 className="text-lg font-medium text-gray-900">Event Catering</h3>
                                                        <p className="text-sm text-gray-500">Guests: {item.guestCount}</p>
                                                        <p className="text-sm text-gray-500">
                                                            Menu: {item.items.map(i => i.name).join(', ')}
                                                        </p>
                                                        <p className="text-gray-900 font-semibold mt-1">₹{item.totalAmount}</p>
                                                    </div>
                                                ) : item.type === 'single_tiffin' ? (
                                                    <div>
                                                        <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
                                                        <p className="text-sm text-gray-500">Plan: {item.planType} | Meal: {item.mealTime}</p>
                                                        <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                                                        <p className="text-sm text-gray-500">
                                                            Menu: {item.menuItems.join(', ')}
                                                        </p>
                                                        <p className="text-gray-900 font-semibold mt-1">₹{item.totalAmount} (incl. delivery)</p>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
                                                        <p className="text-gray-500">₹{item.price}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Quantity Controls (Only for non-event/non-single-tiffin items for now) */}
                                        {item.type !== 'event' && item.type !== 'single_tiffin' && (
                                            <div className="flex items-center space-x-4">
                                                <div className="flex items-center border border-gray-300 rounded-md">
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                        className="p-2 hover:bg-gray-100"
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </button>
                                                    <span className="px-4 py-2 text-gray-900">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                        className="p-2 hover:bg-gray-100"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => removeFromCart(item.id || index)}
                                            className="ml-4 text-red-600 hover:text-red-800"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="lg:w-1/3">
                        <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
                            {(() => {
                                const total = getCartTotal();
                                const delivery = cartItems.reduce((acc, item) => acc + (item.deliveryCharge || 0), 0);
                                const subtotal = total - delivery;

                                return (
                                    <>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-gray-600">Subtotal</span>
                                            <span className="font-medium text-gray-900">₹{subtotal}</span>
                                        </div>
                                        <div className="flex justify-between mb-4">
                                            <span className="text-gray-600">Delivery</span>
                                            <span className="font-medium text-green-600">
                                                {delivery > 0 ? `₹${delivery}` : 'Free'}
                                            </span>
                                        </div>
                                        <div className="border-t border-gray-200 pt-4 flex justify-between mb-6">
                                            <span className="text-xl font-bold text-gray-900">Total</span>
                                            <span className="text-xl font-bold text-gray-900">₹{total}</span>
                                        </div>
                                    </>
                                );
                            })()}
                            <button
                                onClick={handleCheckout}
                                disabled={loading}
                                className="w-full bg-orange-600 text-white py-3 px-4 rounded-md font-medium hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : 'Checkout'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Cart;
