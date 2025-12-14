const Order = require('../models/Order');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
    const {
        items,
        totalAmount,
        type,
        deliveryDate,
        deliveryAddress,
        paymentId,
    } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'No order items' });
    }

    // Cutoff validation
    const now = new Date();
    const delivery = new Date(deliveryDate);
    const diffInHours = (delivery - now) / 1000 / 60 / 60;

    if (type === 'single') {
        if (diffInHours < 12) {
            return res.status(400).json({ message: 'Single day orders must be placed at least 12 hours in advance.' });
        }
    } else if (type === 'event') {
        if (diffInHours < 48) {
            return res.status(400).json({ message: 'Event orders must be placed at least 48 hours in advance.' });
        }
    }

    try {
        const order = new Order({
            user: req.user._id,
            items,
            totalAmount,
            type,
            deliveryDate,
            deliveryAddress,
            paymentId: paymentId || 'DUMMY_PAYMENT_ID',
            paymentStatus: 'Paid', // Assuming immediate payment for now
            status: 'Confirmed', // Auto-confirm since payment is done
        });

        const createdOrder = await order.save();
        res.status(201).json(createdOrder);
    } catch (error) {
        res.status(400).json({ message: 'Invalid order data', error: error.message });
    }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .populate('subscription');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'name email');

        if (order) {
            // Check if user is owner or admin/employee
            if (
                order.user._id.toString() === req.user._id.toString() ||
                req.user.role === 'admin' ||
                req.user.role === 'employee'
            ) {
                res.json(order);
            } else {
                res.status(401).json({ message: 'Not authorized to view this order' });
            }
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin/Employee
const updateOrderStatus = async (req, res) => {
    const { status } = req.body;

    try {
        const order = await Order.findById(req.params.id);

        if (order) {
            order.status = status;
            const updatedOrder = await order.save();
            res.json(updatedOrder);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all orders (Admin/Employee)
// @route   GET /api/orders
// @access  Private/Admin/Employee
const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).populate('user', 'id name').sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create Razorpay Order for Cart
// @route   POST /api/orders/razorpay
// @access  Private
const createRazorpayOrder = async (req, res) => {
    const { amount } = req.body;

    console.log('Creating Razorpay order for amount:', amount);

    try {
        const options = {
            amount: Math.round(amount * 100), // Amount in paise, rounded to nearest integer
            currency: 'INR',
            receipt: `receipt_cart_${Date.now()}`,
        };

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const order = await razorpay.orders.create(options);

        res.json({
            id: order.id,
            currency: order.currency,
            amount: order.amount,
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ message: 'Error creating payment order', error: error.message });
    }
};

// @desc    Verify Payment for Cart
// @route   POST /api/orders/verify
// @access  Private
const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    try {
        const body = razorpay_order_id + '|' + razorpay_payment_id;

        console.log('Verifying Payment:');
        console.log('Order ID:', razorpay_order_id);
        console.log('Payment ID:', razorpay_payment_id);
        console.log('Received Signature:', razorpay_signature);

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        console.log('Expected Signature:', expectedSignature);

        if (expectedSignature !== razorpay_signature) {
            console.log('Signature Mismatch!');
            return res.status(400).json({ message: 'Invalid payment signature' });
        }

        res.json({ message: 'Payment verified successfully', paymentId: razorpay_payment_id });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    createOrder,
    getMyOrders,
    getOrderById,
    updateOrderStatus,
    getOrders,
    createRazorpayOrder,
    verifyPayment,
};
