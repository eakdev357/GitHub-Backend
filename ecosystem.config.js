// ecosystem.config.js - การตั้งค่า PM2
module.exports = {
  apps: [{
    name: 'production-backend',
    script: 'server.js',
    
    // การตั้งค่าพื้นฐาน
    instances: 2, // จำนวน instance (หรือใช้ 'max' สำหรับ CPU cores ทั้งหมด)
    exec_mode: 'cluster', // cluster mode สำหรับ load balancing
    
    // การตั้งค่าสภาพแวดล้อม
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // การจัดการ Memory และ CPU
    max_memory_restart: '500M', // restart เมื่อใช้ RAM เกิน 500MB
    node_args: '--max-old-space-size=512', // จำกัด V8 heap size
    
    // การจัดการ Log
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Auto Restart
    watch: false, // ปิด watch ใน production (เปิดได้ใน development)
    ignore_watch: ['node_modules', 'logs', '*.log'],
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // การตั้งค่าเพิ่มเติม
    kill_timeout: 5000, // เวลารอก่อน force kill (ms)
    wait_ready: true, // รอให้ app พร้อมก่อนเริ่ม instance ถัดไป
    listen_timeout: 10000, // เวลารอการ listen port
    
    // Cron restart (optional)
    cron_restart: '0 2 * * *', // restart ทุกวันเวลา 02:00
    
    // การตั้งค่า User (สำหรับ Linux)
    // user: 'www-data',
    // group: 'www-data',
  }],
  
  // การตั้งค่า Deploy (สำหรับ deploy ผ่าน PM2)
  deploy: {
    production: {
      user: 'administrator', // เปลี่ยนเป็น username ของคุณ
      host: '192.168.77.26',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/production-backend.git', // เปลี่ยนเป็น repo ของคุณ
      path: '/var/www/production-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};