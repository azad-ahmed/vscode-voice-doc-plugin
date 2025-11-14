
class UserService {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
    }

    async getUser(userId) {
        const response = await fetch(`${this.apiUrl}/users/${userId}`);
        return response.json();
    }

    async createUser(userData) {
        const response = await fetch(`${this.apiUrl}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return response.json();
    }

    async deleteUser(userId) {
        const response = await fetch(`${this.apiUrl}/users/${userId}`, {
            method: 'DELETE'
        });
        return response.ok;
    }
}

// ==========================================
// TEST 2: KLASSE MIT PROPERTIES
// ==========================================

class ShoppingCart {
    constructor() {
        this.items = [];
        this.total = 0;
        this.discount = 0;
    }

    addItem(product, quantity) {
        this.items.push({ product, quantity });
        this.calculateTotal();
    }

    removeItem(productId) {
        this.items = this.items.filter(item => item.product.id !== productId);
        this.calculateTotal();
    }

    applyDiscount(percentage) {
        this.discount = percentage;
        this.calculateTotal();
    }

    calculateTotal() {
        const subtotal = this.items.reduce((sum, item) => {
            return sum + (item.product.price * item.quantity);
        }, 0);
        this.total = subtotal * (1 - this.discount / 100);
    }

    checkout() {
        if (this.items.length === 0) {
            throw new Error('Cart is empty');
        }
        return {
            items: this.items,
            total: this.total,
            itemCount: this.items.length
        };
    }
}

// ==========================================
// TEST 3: VERERBUNG
// ==========================================

class Animal {
    constructor(name, age) {
        this.name = name;
        this.age = age;
    }

    makeSound() {
        return 'Some sound';
    }

    getInfo() {
        return `${this.name} is ${this.age} years old`;
    }
}

class Dog extends Animal {
    constructor(name, age, breed) {
        super(name, age);
        this.breed = breed;
    }

    makeSound() {
        return 'Woof! Woof!';
    }

    fetch(item) {
        return `${this.name} is fetching ${item}`;
    }
}

// ==========================================
// TEST 4: SINGLETON PATTERN
// ==========================================

class DatabaseConnection {
    static instance = null;

    constructor(config) {
        if (DatabaseConnection.instance) {
            return DatabaseConnection.instance;
        }
        this.config = config;
        this.isConnected = false;
        DatabaseConnection.instance = this;
    }

    connect() {
        if (!this.isConnected) {
            console.log('Connecting to database...');
            this.isConnected = true;
        }
        return this.isConnected;
    }

    disconnect() {
        if (this.isConnected) {
            console.log('Disconnecting from database...');
            this.isConnected = false;
        }
    }

    query(sql) {
        if (!this.isConnected) {
            throw new Error('Not connected to database');
        }
        return `Executing: ${sql}`;
    }

    static getInstance(config) {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection(config);
        }
        return DatabaseConnection.instance;
    }
}

// ==========================================
// TEST 5: FACTORY PATTERN
// ==========================================

class PaymentFactory {
    static createPayment(type, amount) {
        switch (type) {
            case 'credit-card':
                return new CreditCardPayment(amount);
            case 'paypal':
                return new PayPalPayment(amount);
            case 'crypto':
                return new CryptoPayment(amount);
            default:
                throw new Error(`Unknown payment type: ${type}`);
        }
    }
}

class CreditCardPayment {
    constructor(amount) {
        this.amount = amount;
        this.type = 'credit-card';
    }

    process(cardNumber, cvv) {
        return `Processing $${this.amount} via Credit Card`;
    }
}

class PayPalPayment {
    constructor(amount) {
        this.amount = amount;
        this.type = 'paypal';
    }

    process(email) {
        return `Processing $${this.amount} via PayPal (${email})`;
    }
}

// ==========================================
// TEST 6: FUNKTIONEN (NICHT IN KLASSEN)
// ==========================================

function calculateFibonacci(n) {
    if (n <= 1) return n;
    return calculateFibonacci(n - 1) + calculateFibonacci(n - 2);
}

function sortArray(arr, ascending = true) {
    return arr.sort((a, b) => ascending ? a - b : b - a);
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

const throttle = (func, limit) => {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// ==========================================
// TEST 7: ASYNC/AWAIT FUNKTIONEN
// ==========================================

async function fetchUserData(userId) {
    try {
        const response = await fetch(`https://api.example.com/users/${userId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
    }
}

async function processMultipleUsers(userIds) {
    const promises = userIds.map(id => fetchUserData(id));
    const results = await Promise.all(promises);
    return results.filter(user => user !== null);
}

// ==========================================
// TEST 8: KOMPLEXE KLASSE
// ==========================================

class TaskManager {
    constructor() {
        this.tasks = new Map();
        this.nextId = 1;
        this.listeners = [];
    }

    addTask(title, description, priority = 'medium') {
        const task = {
            id: this.nextId++,
            title,
            description,
            priority,
            status: 'pending',
            createdAt: new Date(),
            completedAt: null
        };
        this.tasks.set(task.id, task);
        this.notifyListeners('taskAdded', task);
        return task;
    }

    completeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        task.status = 'completed';
        task.completedAt = new Date();
        this.notifyListeners('taskCompleted', task);
        return task;
    }

    deleteTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        this.tasks.delete(taskId);
        this.notifyListeners('taskDeleted', task);
        return true;
    }

    getTasksByPriority(priority) {
        return Array.from(this.tasks.values())
            .filter(task => task.priority === priority)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    getTasksByStatus(status) {
        return Array.from(this.tasks.values())
            .filter(task => task.status === status);
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            try {
                listener(event, data);
            } catch (error) {
                console.error('Listener error:', error);
            }
        });
    }

    getStatistics() {
        const tasks = Array.from(this.tasks.values());
        return {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            highPriority: tasks.filter(t => t.priority === 'high').length
        };
    }
}

// ==========================================
// TEST 9: UTILITY-KLASSE
// ==========================================

class StringUtils {
    static capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    static camelCase(str) {
        return str
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            })
            .replace(/\s+/g, '');
    }

    static kebabCase(str) {
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/\s+/g, '-')
            .toLowerCase();
    }

    static truncate(str, maxLength, suffix = '...') {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - suffix.length) + suffix;
    }

    static reverse(str) {
        return str.split('').reverse().join('');
    }
}

// ==========================================
// TEST 10: EVENT EMITTER
// ==========================================

class EventEmitter {
    constructor() {
        this.events = new Map();
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
        return this;
    }

    off(event, callback) {
        if (!this.events.has(event)) return this;
        
        if (callback) {
            const callbacks = this.events.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        } else {
            this.events.delete(event);
        }
        return this;
    }

    emit(event, ...args) {
        if (!this.events.has(event)) return false;
        
        const callbacks = this.events.get(event);
        callbacks.forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
        return true;
    }

    once(event, callback) {
        const wrapper = (...args) => {
            callback(...args);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }

    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        UserService,
        ShoppingCart,
        Animal,
        Dog,
        DatabaseConnection,
        PaymentFactory,
        TaskManager,
        StringUtils,
        EventEmitter
    };
}

console.log('✅ Test-File geladen! Starte deine Tests mit Ctrl+Shift+A');
