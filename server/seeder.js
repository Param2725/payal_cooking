const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Plan = require('./models/Plan');
const Menu = require('./models/Menu');
const EventItem = require('./models/EventItem');

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const seedData = async () => {
    await connectDB();

    try {
        // Clear existing data
        await Plan.deleteMany();
        await Menu.deleteMany();
        console.log('Data Cleared!');

        // --- PLANS ---
        const plans = [
            // Basic
            {
                name: 'Basic',
                price: 3000,
                duration: 'monthly',
                description: 'Simple home-cooked meals for everyday sustenance.',
                features: ['Lunch, Dinner', 'Standard Menu', 'Weekend Special not included'],
            },
            {
                name: 'Basic',
                price: 30000, // 2 months free
                duration: 'yearly',
                description: 'Simple home-cooked meals for everyday sustenance.',
                features: ['Lunch, Dinner', 'Standard Menu', 'Weekend Special not included'],
            },
            // Premium
            {
                name: 'Premium',
                price: 5000,
                duration: 'monthly',
                description: 'Delicious meals with added variety and sweets.',
                features: ['Lunch, Dinner', 'Premium Menu', 'Includes Sweets & Salad', 'Weekend Special included'],
            },
            {
                name: 'Premium',
                price: 50000, // 2 months free
                duration: 'yearly',
                description: 'Delicious meals with added variety and sweets.',
                features: ['Lunch, Dinner', 'Premium Menu', 'Includes Sweets & Salad', 'Weekend Special included'],
            },
            // Exotic
            {
                name: 'Exotic',
                price: 8000,
                duration: 'monthly',
                description: 'Gourmet experience with multi-cuisine options.',
                features: ['Lunch, Dinner', 'Exotic Menu', 'Includes Sweets, Salad, Soups', 'Weekend Special included', 'Customizable Spice Levels'],
            },
            {
                name: 'Exotic',
                price: 80000, // 2 months free
                duration: 'yearly',
                description: 'Gourmet experience with multi-cuisine options.',
                features: ['Lunch, Dinner', 'Exotic Menu', 'Includes Sweets, Salad, Soups', 'Weekend Special included', 'Customizable Spice Levels'],
            },
        ];

        await Plan.insertMany(plans);
        console.log('Plans Imported!');

        // --- MENUS (Next 12 Months) ---
        const menus = [];
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        // Define 4 weekly templates to rotate through months
        const weeklyTemplates = [
            { // Template 1
                Basic: {
                    lunch: ['Dal Fry', 'Jeera Rice', 'Roti (3)', 'Aloo Gobi'],
                    dinner: ['Khichdi', 'Kadhi', 'Papad'],
                },
                Premium: {
                    lunch: ['Paneer Butter Masala', 'Dal Makhani', 'Jeera Rice', 'Butter Naan (2)', 'Gulab Jamun', 'Green Salad'],
                    dinner: ['Veg Biryani', 'Raita', 'Salad'],
                },
                Exotic: {
                    lunch: ['Thai Green Curry', 'Jasmine Rice', 'Spring Rolls', 'Mango Sticky Rice', 'Kimchi Salad'],
                    dinner: ['Pasta Alfredo', 'Garlic Bread', 'Caesar Salad', 'Tiramisu'],
                }
            },
            { // Template 2
                Basic: {
                    lunch: ['Rajma Chawal', 'Roti (3)', 'Mix Veg'],
                    dinner: ['Dal Tadka', 'Rice', 'Pickle'],
                },
                Premium: {
                    lunch: ['Malai Kofta', 'Dal Fry', 'Peas Pulao', 'Naan (2)', 'Rasgulla', 'Salad'],
                    dinner: ['Palak Paneer', 'Roti', 'Raita'],
                },
                Exotic: {
                    lunch: ['Mexican Burrito Bowl', 'Nachos', 'Salsa', 'Churros', 'Corn Salad'],
                    dinner: ['Risotto', 'Bruschetta', 'Greek Salad', 'Cheesecake'],
                }
            },
            { // Template 3
                Basic: {
                    lunch: ['Chole Bhature', 'Rice', 'Salad'],
                    dinner: ['Veg Pulao', 'Raita'],
                },
                Premium: {
                    lunch: ['Shahi Paneer', 'Dal Tadka', 'Jeera Rice', 'Kulcha (2)', 'Kheer', 'Sprouts Salad'],
                    dinner: ['Mushroom Masala', 'Paratha', 'Salad'],
                },
                Exotic: {
                    lunch: ['Sushi Platter', 'Miso Soup', 'Edamame', 'Mochi', 'Seaweed Salad'],
                    dinner: ['Lasagna', 'Garlic Knots', 'Caprese Salad', 'Gelato'],
                }
            },
            { // Template 4
                Basic: {
                    lunch: ['Bhindi Masala', 'Dal', 'Roti (3)', 'Rice'],
                    dinner: ['Tomato Soup', 'Bread Sticks', 'Salad'],
                },
                Premium: {
                    lunch: ['Veg Kolhapuri', 'Dal Makhani', 'Biryani', 'Roti (2)', 'Ice Cream', 'Russian Salad'],
                    dinner: ['Paneer Tikka Masala', 'Naan', 'Raita'],
                },
                Exotic: {
                    lunch: ['Falafel Wrap', 'Hummus', 'Pita Bread', 'Baklava', 'Tabbouleh'],
                    dinner: ['Pizza Margherita', 'Chicken Wings (Veg)', 'Coleslaw', 'Brownie'],
                }
            }
        ];

        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const month = currentDate.getMonth();
            const dayOfWeek = currentDate.getDay(); // 0 is Sunday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            // Rotate templates based on month (0-11) % 4
            const template = weeklyTemplates[month % 4];

            // Basic Menu
            menus.push({
                date: new Date(currentDate),
                planType: 'Basic',
                items: template.Basic,
                isWeekendSpecial: false,
            });

            // Premium Menu
            menus.push({
                date: new Date(currentDate),
                planType: 'Premium',
                items: template.Premium,
                isWeekendSpecial: isWeekend,
            });

            // Exotic Menu
            menus.push({
                date: new Date(currentDate),
                planType: 'Exotic',
                items: template.Exotic,
                isWeekendSpecial: isWeekend,
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Insert in chunks to avoid memory issues if too large, but 1000 items is fine
        await Menu.insertMany(menus);
        console.log('Menus Imported!');

        // --- EVENT ITEMS ---
        await EventItem.deleteMany();
        const eventItems = [
            // Starters
            { name: 'Paneer Tikka', category: 'Starter', price: 150, description: 'Spiced grilled cottage cheese chunks.' },
            { name: 'Veg Manchurian', category: 'Starter', price: 120, description: 'Indo-Chinese fried veg balls.' },
            { name: 'Hara Bhara Kabab', category: 'Starter', price: 130, description: 'Spinach and green pea patties.' },
            { name: 'Spring Rolls', category: 'Starter', price: 100, description: 'Crispy rolls with veg filling.' },

            // Main Course
            { name: 'Paneer Butter Masala', category: 'Main Course', price: 200, description: 'Rich tomato gravy with paneer.' },
            { name: 'Dal Makhani', category: 'Main Course', price: 180, description: 'Creamy black lentils.' },
            { name: 'Veg Biryani', category: 'Main Course', price: 160, description: 'Aromatic rice with vegetables.' },
            { name: 'Malai Kofta', category: 'Main Course', price: 220, description: 'Fried dumplings in cashew gravy.' },
            { name: 'Butter Naan', category: 'Main Course', price: 40, description: 'Soft flatbread with butter.' },

            // Desserts
            { name: 'Gulab Jamun', category: 'Dessert', price: 60, description: 'Sweet milk solids in syrup.' },
            { name: 'Rasmalai', category: 'Dessert', price: 80, description: 'Cottage cheese balls in thickened milk.' },
            { name: 'Gajar Ka Halwa', category: 'Dessert', price: 90, description: 'Carrot pudding.' },
            { name: 'Ice Cream (Vanilla)', category: 'Dessert', price: 50, description: 'Classic vanilla scoop.' },

            // Beverages
            { name: 'Masala Chai', category: 'Beverage', price: 30, description: 'Spiced Indian tea.' },
            { name: 'Fresh Lime Soda', category: 'Beverage', price: 60, description: 'Refreshing lemon drink.' },
            { name: 'Lassi', category: 'Beverage', price: 70, description: 'Sweet yogurt drink.' },
            { name: 'Soft Drink', category: 'Beverage', price: 40, description: 'Coke/Pepsi/Sprite.' },
        ];

        await EventItem.insertMany(eventItems);
        console.log('Event Items Imported!');

        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

seedData();
