const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const User = require('../models/User');
const Order = require('../models/Order');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Buy a subscription (Create Razorpay Order)
// @route   POST /api/subscriptions
// @access  Private
const buySubscription = async (req, res) => {
    const { planId } = req.body;

    try {
        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        const options = {
            amount: plan.price * 100, // Amount in paise
            currency: 'INR',
            receipt: `receipt_order_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            planId: plan._id,
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ message: 'Error creating payment order', error: error.message });
    }
};

// @desc    Verify Payment and Activate Subscription
// @route   POST /api/subscriptions/verify
// @access  Private
const verifySubscriptionPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;

    try {
        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ message: 'Invalid payment signature' });
        }

        const plan = await Plan.findById(planId);

        // Calculate dates
        const startDate = new Date();
        const endDate = new Date();
        if (plan.duration === 'monthly') {
            endDate.setMonth(endDate.getMonth() + 1);
        } else if (plan.duration === 'yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
        }

        const subscription = new Subscription({
            user: req.user._id,
            plan: plan._id,
            startDate,
            endDate,
            status: 'Active',
            paymentId: razorpay_payment_id,
            amountPaid: plan.price,
        });

        const createdSubscription = await subscription.save();

        // Update user's current subscription
        const user = await User.findById(req.user._id);
        user.currentSubscription = createdSubscription._id;
        await user.save();

        // Create Order record
        const order = new Order({
            user: req.user._id,
            items: [{
                name: `${plan.name} Plan (${plan.duration})`,
                quantity: 1,
                price: plan.price
            }],
            totalAmount: plan.price,
            status: 'Confirmed',
            type: 'subscription_purchase',
            deliveryDate: new Date(),
            paymentStatus: 'Paid',
            paymentId: razorpay_payment_id,
            subscription: createdSubscription._id // Link to subscription
        });

        await order.save();

        res.status(201).json({ subscription: createdSubscription, order });

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Cancel Subscription
// @route   POST /api/subscriptions/cancel
// @access  Private
const cancelSubscription = async (req, res) => {
    const { subscriptionId } = req.body;

    try {
        const subscription = await Subscription.findOne({
            _id: subscriptionId,
            user: req.user._id
        });

        if (!subscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        if (subscription.status !== 'Active') {
            return res.status(400).json({ message: 'Subscription is not active' });
        }

        subscription.status = 'Cancelled';
        await subscription.save();

        // Also update the user's current subscription reference if it matches
        const user = await User.findById(req.user._id);
        if (user.currentSubscription && user.currentSubscription.toString() === subscriptionId) {
            user.currentSubscription = null;
            await user.save();
        }

        res.json({ message: 'Subscription cancelled successfully', subscription });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Initiate Subscription Renewal
// @route   POST /api/subscriptions/renew-init
// @access  Private
const renewSubscription = async (req, res) => {
    const { subscriptionId } = req.body;

    try {
        const subscription = await Subscription.findOne({
            _id: subscriptionId,
            user: req.user._id
        }).populate('plan');

        if (!subscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        const plan = subscription.plan;

        if (!plan) {
            return res.status(404).json({ message: 'Plan associated with this subscription was not found. Please buy a new subscription.' });
        }

        const options = {
            amount: plan.price * 100, // Amount in paise
            currency: 'INR',
            receipt: `receipt_renew_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            subscriptionId: subscription._id,
            planId: plan._id,
        });

    } catch (error) {
        console.error('Error initiating renewal:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Verify Renewal Payment
// @route   POST /api/subscriptions/renew-verify
// @access  Private
const verifyRenewal = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, subscriptionId } = req.body;

    try {
        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ message: 'Invalid payment signature' });
        }

        const subscription = await Subscription.findOne({
            _id: subscriptionId,
            user: req.user._id
        }).populate('plan');

        if (!subscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        const plan = subscription.plan;

        // Calculate new dates
        const startDate = new Date();
        const endDate = new Date();
        if (plan.duration === 'monthly') {
            endDate.setMonth(endDate.getMonth() + 1);
        } else if (plan.duration === 'yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
        }

        // Update Subscription
        subscription.startDate = startDate;
        subscription.endDate = endDate;
        subscription.status = 'Active';
        subscription.paymentId = razorpay_payment_id;
        subscription.amountPaid = plan.price;

        await subscription.save();

        // Update User's current subscription
        const user = await User.findById(req.user._id);
        user.currentSubscription = subscription._id;
        await user.save();

        // Update existing Order (Find the order associated with this subscription)
        // We assume 1-to-1 mapping for simplicity in this flow, or find the latest one.
        // Actually, the user asked to "refresh on that old order".
        // Let's find the order that links to this subscription.
        const order = await Order.findOne({ subscription: subscription._id });

        if (order) {
            order.paymentStatus = 'Paid';
            order.paymentId = razorpay_payment_id;
            order.status = 'Confirmed'; // Reset status if it was cancelled
            order.deliveryDate = new Date(); // Update delivery date to now? Or keep original? "Refresh" implies update.
            order.updatedAt = new Date();
            await order.save();
        }

        res.json({ message: 'Subscription renewed successfully', subscription, order });

    } catch (error) {
        console.error('Error verifying renewal:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get my subscription
// @route   GET /api/subscriptions/me
// @access  Private
const getMySubscription = async (req, res) => {
    try {
        const subscription = await Subscription.findOne({
            user: req.user._id,
            status: 'Active',
        }).populate('plan');

        if (subscription) {
            res.json(subscription);
        } else {
            res.status(404).json({ message: 'No active subscription found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    buySubscription,
    verifySubscriptionPayment,
    cancelSubscription,
    renewSubscription,
    verifyRenewal,
    getMySubscription,
};
