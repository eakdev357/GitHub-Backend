// server.js - Web Application สำหรับระบบคิวการผลิต
const express = require('express');
const sql = require('mssql');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

// การตั้งค่าฐานข้อมูล
const dbConfig = {
    server: process.env.DB_SERVER || '192.168.77.26',
    database: process.env.DB_NAME || 'qrcode',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'password@1',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        requestTimeout: 30000,
        connectionTimeout: 30000
    }
};

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// เชื่อมต่อฐานข้อมูล
let dbConnected = false;
sql.connect(dbConfig).then(pool => {
    console.log('✅ เชื่อมต่อ SQL Server สำเร็จ');
    dbConnected = true;
}).catch(err => {
    console.error('❌ เชื่อมต่อฐานข้อมูลไม่สำเร็จ:', err.message);
    dbConnected = false;
});

// ===================== Web Routes =====================

// หน้าแรก - Dashboard
app.get('/', async (req, res) => {
    try {
        if (!dbConnected) {
            return res.render('dashboard', { 
                title: 'ระบบจัดการคิวการผลิต',
                contracts: [],
                dbError: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'
            });
        }

        const pool = await sql.connect(dbConfig);
        
        // ดึงข้อมูลสัญญา
        const contractResult = await pool.request().query(`
            SELECT 
                c.Contract_ID,
                c.Contract_Number,
                c.Customer_ID,
                c.Created_Date,
                c.Created_User,
                COUNT(cp.ContractPackage_ID) as package_count,
                SUM(cp.Target_Quantity) as total_target
            FROM Contract c
            LEFT JOIN ContractPackage cp ON c.Contract_ID = cp.Contract_ID
            GROUP BY c.Contract_ID, c.Contract_Number, c.Customer_ID, c.Created_Date, c.Created_User
            ORDER BY c.Created_Date DESC
        `);

        // ดึงข้อมูลคิวการผลิต
        const orderResult = await pool.request().query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM ProductionOrder
            GROUP BY status
        `);

        const orderStats = {
            pending: 0,
            active: 0,
            completed: 0,
            cancelled: 0
        };

        orderResult.recordset.forEach(row => {
            switch(row.status) {
                case 1: orderStats.pending = row.count; break;
                case 2: orderStats.active = row.count; break;
                case 3: orderStats.completed = row.count; break;
                case 4: orderStats.cancelled = row.count; break;
            }
        });
        
        res.render('dashboard', { 
            title: 'ระบบจัดการคิวการผลิต',
            contracts: contractResult.recordset,
            orderStats: orderStats,
            dbError: null
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.render('dashboard', { 
            title: 'ระบบจัดการคิวการผลิต',
            contracts: [],
            orderStats: { pending: 0, active: 0, completed: 0, cancelled: 0 },
            dbError: 'เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message
        });
    }
});

// หน้าจัดการ Contract
app.get('/contracts', async (req, res) => {
    try {
        if (!dbConnected) {
            return res.render('contracts', { 
                title: 'จัดการสัญญา',
                contracts: [],
                error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'
            });
        }

        const pool = await sql.connect(dbConfig);
        const contractResult = await pool.request().query(`
            SELECT 
                c.*,
                COUNT(cp.ContractPackage_ID) as package_count,
                SUM(cp.Target_Quantity) as total_target
            FROM Contract c
            LEFT JOIN ContractPackage cp ON c.Contract_ID = cp.Contract_ID
            GROUP BY c.Contract_ID, c.Contract_Number, c.Customer_ID, c.Created_Date, c.Created_User
            ORDER BY c.Created_Date DESC
        `);
        
        res.render('contracts', { 
            title: 'จัดการสัญญา',
            contracts: contractResult.recordset,
            error: null
        });
    } catch (error) {
        console.error('Error loading contracts:', error);
        res.render('contracts', { 
            title: 'จัดการสัญญา',
            contracts: [],
            error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message
        });
    }
});

// หน้าสร้าง Contract ใหม่
app.get('/contracts/new', async (req, res) => {
    try {
        if (!dbConnected) {
            return res.render('contract_form', { 
                title: 'สร้างสัญญาใหม่',
                contract: null,
                packageTypes: [],
                error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'
            });
        }

        const pool = await sql.connect(dbConfig);
        const packageTypes = await pool.request().query(`
            SELECT * FROM PackageType ORDER BY PackageType_Name
        `);
        
        res.render('contract_form', { 
            title: 'สร้างสัญญาใหม่',
            contract: null,
            packageTypes: packageTypes.recordset,
            error: null
        });
    } catch (error) {
        console.error('Error loading package types:', error);
        res.render('contract_form', { 
            title: 'สร้างสัญญาใหม่',
            contract: null,
            packageTypes: [],
            error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message
        });
    }
});

// บันทึก Contract ใหม่
app.post('/contracts', async (req, res) => {
    try {
        const { contract_number, customer_id, created_user } = req.body;
        
        if (!dbConnected) {
            return res.render('error', { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
        }

        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('contract_number', sql.NVarChar(50), contract_number)
            .input('customer_id', sql.Int, customer_id)
            .input('created_user', sql.NVarChar(50), created_user)
            .query(`
                INSERT INTO Contract (Contract_Number, Customer_ID, Created_User)
                VALUES (@contract_number, @customer_id, @created_user)
            `);
        
        res.redirect('/contracts');
        
    } catch (error) {
        console.error('Error creating contract:', error);
        res.render('error', { error: 'เกิดข้อผิดพลาดในการสร้างสัญญา: ' + error.message });
    }
});

// หน้าคิวการผลิต
app.get('/production-queue', async (req, res) => {
    try {
        if (!dbConnected) {
            return res.render('production_queue', {
                title: 'คิวการผลิต',
                orders: [],
                error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'
            });
        }

        const pool = await sql.connect(dbConfig);
        
        const ordersResult = await pool.request().query(`
            SELECT 
                po.*,
                CASE po.status
                    WHEN 1 THEN 'รอดำเนินการ'
                    WHEN 2 THEN 'กำลังผลิต'
                    WHEN 3 THEN 'เสร็จสิ้น'
                    WHEN 4 THEN 'ยกเลิก'
                    ELSE 'ไม่ระบุ'
                END as status_text,
                CASE po.shift_id
                    WHEN 'A' THEN 'กะ A (06:00-14:00)'
                    WHEN 'B' THEN 'กะ B (14:00-22:00)'
                    WHEN 'C' THEN 'กะ C (22:00-06:00)'
                    ELSE po.shift_id
                END as shift_text
            FROM ProductionOrder po
            ORDER BY po.created_at DESC
        `);
        
        res.render('production_queue', {
            title: 'คิวการผลิต',
            orders: ordersResult.recordset,
            error: null
        });
        
    } catch (error) {
        console.error('Error loading production queue:', error);
        res.render('production_queue', {
            title: 'คิวการผลิต',
            orders: [],
            error: 'เกิดข้อผิดพลาดในการโหลดคิวการผลิต: ' + error.message
        });
    }
});

// หน้าสร้างคิวการผลิตใหม่
app.get('/production-queue/new', (req, res) => {
    res.render('production_order_form', {
        title: 'สร้างคิวการผลิต',
        order: null,
        error: null
    });
});

// บันทึกคิวการผลิตใหม่
app.post('/production-queue', async (req, res) => {
    try {
        const { order_code, customer_id, package_type_id, shift_id, target_quantity } = req.body;
        
        if (!dbConnected) {
            return res.render('error', { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
        }

        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('order_code', sql.NVarChar(10), order_code)
            .input('customer_id', sql.Int, customer_id)
            .input('package_type_id', sql.Int, package_type_id || 1)
            .input('shift_id', sql.Char(1), shift_id)
            .input('target_quantity', sql.Int, target_quantity)
            .input('status', sql.Int, 1)
            .query(`
                INSERT INTO ProductionOrder 
                (order_code, customer_id, package_type_id, shift_id, created_at, status, target_quantity)
                VALUES (@order_code, @customer_id, @package_type_id, @shift_id, GETDATE(), @status, @target_quantity)
            `);
        
        res.redirect('/production-queue');
        
    } catch (error) {
        console.error('Error creating production order:', error);
        res.render('error', { error: 'เกิดข้อผิดพลาดในการสร้างคิวการผลิต: ' + error.message });
    }
});

// อัปเดตสถานะคิวการผลิต
app.post('/production-queue/:id/status', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;
        
        if (!dbConnected) {
            return res.json({ success: false, message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
        }

        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('order_id', sql.Int, orderId)
            .input('status', sql.Int, status)
            .query(`
                UPDATE ProductionOrder 
                SET status = @status
                WHERE id = @order_id
            `);
        
        res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
        
    } catch (error) {
        console.error('Error updating status:', error);
        res.json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + error.message });
    }
});

// Error handling
app.use((req, res) => {
    res.status(404).render('error', { error: 'ไม่พบหน้าที่ต้องการ' });
});

// เริ่มต้นเซิร์ฟเวอร์
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 เซิร์ฟเวอร์ทำงานที่พอร์ต ${PORT}`);
    console.log(`🌐 เปิดเว็บไซต์ที่ http://localhost:${PORT}`);
});

// จัดการการปิดโปรแกรม
process.on('SIGINT', async () => {
    console.log('กำลังปิดเซิร์ฟเวอร์...');
    await sql.close();
    process.exit(0);
});