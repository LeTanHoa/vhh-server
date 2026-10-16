import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import Product from './models/Product.js';
import QrRequest from './models/QrRequest.js';
import { defaultSeedProducts } from './seedData.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root or server directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==========================================
// CLOUDINARY CONFIGURATION
// ==========================================
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

if (isCloudinaryConfigured) {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      api_key: process.env.CLOUDINARY_API_KEY.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET.trim()
    });
  }
  console.log('☁️  CLOUDINARY: Đã cấu hình và sẵn sàng lưu trữ hình ảnh!');
} else {
  console.log('☁️  CLOUDINARY: Chưa điền thông tin trong .env (Tạm thời lưu ảnh dạng Base64/Local).');
}

// In-Memory Fallback Store (in case MongoDB is not yet connected)
let inMemoryProducts = JSON.parse(JSON.stringify(defaultSeedProducts)).map((p, idx) => ({
  ...p,
  _id: `mock_${idx + 1}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}));

let inMemoryQrRequests = [];


let isDbConnected = false;
let dbConnectionError = null;

const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
const mongoUri = rawUri.trim().replace(/^['"]|['"]$/g, '');

// MongoDB Connection Logic
async function connectToMongo() {
  if (!mongoUri) {
    dbConnectionError = 'Chưa điền MONGODB_URI trong file .env';
    console.log('\n======================================================');
    console.log('⚠️  CHƯA CẤU HÌNH MONGODB_URI');
    console.log('👉 Vui lòng mở file .env ở thư mục gốc và dán link kết nối MongoDB:');
    console.log('   MONGODB_URI=mongodb+srv://user:pass@cluster0.xxx.mongodb.net/vhh_db');
    console.log('💡 Hệ thống đang chạy ở chế độ In-Memory Fallback với dữ liệu mẫu.');
    console.log('======================================================\n');
    return;
  }

  if (mongoUri.includes('<password>') || mongoUri.includes('<db_password>')) {
    console.warn('\n⚠️  CẢNH BÁO: Link MONGODB_URI vẫn còn chứa placeholder <password>. Vui lòng thay bằng mật khẩu thật!\n');
  }

  try {
    console.log('🔄 Đang kết nối tới MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
    });

    isDbConnected = true;
    dbConnectionError = null;
    console.log('✅ ĐÃ KẾT NỐI MONGODB THÀNH CÔNG!');

    // Check & Auto Seed
    const count = await Product.countDocuments();
    if (count === 0) {
      console.log('🌱 Database đang trống, tiến hành nạp dữ liệu mẫu ban đầu...');
      await Product.insertMany(defaultSeedProducts);
      console.log(`✅ Đã nạp thành công ${defaultSeedProducts.length} sản phẩm mẫu vào MongoDB!`);
    } else {
      console.log(`📦 Tìm thấy ${count} sản phẩm đã có sẵn trong MongoDB.`);
      // Đảm bảo Kẹo dừa dẻo Ngọc Hải có trong DB
      const ngocHaiExists = await Product.findOne({ name: /Kẹo dừa dẻo Ngọc Hải/i });
      if (!ngocHaiExists) {
        console.log('🥥 Tự động nạp thêm Kẹo dừa dẻo Ngọc Hải vào MongoDB...');
        await Product.create(defaultSeedProducts[0]);
      }
    }
  } catch (err) {
    isDbConnected = false;
    dbConnectionError = err.message;
    console.error('\n❌ LỖI KẾT NỐI MONGODB:', err.message);
    if (err.message.includes('whitelist') || err.message.includes('MongooseServerSelectionError')) {
      console.error('👉 GỢI Ý: Hãy kiểm tra IP Whitelist trên MongoDB Atlas (vào Network Access -> thêm 0.0.0.0/0).');
    }
    console.log('💡 Hệ thống tự động chuyển sang chế độ In-Memory để không làm gián đoạn ứng dụng.\n');
  }
}

connectToMongo();

// Monitor connection changes
mongoose.connection.on('disconnected', () => {
  isDbConnected = false;
  console.warn('⚠️  MongoDB bị mất kết nối.');
});
mongoose.connection.on('reconnected', () => {
  isDbConnected = true;
  dbConnectionError = null;
  console.log('✅  MongoDB đã kết nối lại.');
});

// Serverless auto-reconnect middleware: ensure DB connection on incoming requests
app.use(async (req, res, next) => {
  if (!isDbConnected && mongoUri) {
    await connectToMongo();
  }
  next();
});
// API ROUTES
// ==========================================

// 1. Health & Connection Status
app.get('/api/status', async (req, res) => {
  let count = 0;
  if (isDbConnected) {
    try {
      count = await Product.countDocuments();
    } catch {
      count = 0;
    }
  } else {
    count = inMemoryProducts.length;
  }

  res.json({
    status: 'ok',
    dbConnected: isDbConnected,
    uriConfigured: Boolean(mongoUri),
    cloudinaryConfigured: isCloudinaryConfigured,
    error: dbConnectionError,
    productCount: count,
    storageType: isDbConnected ? 'MongoDB Database' : 'In-Memory Cache (Chờ link MongoDB)',
    timestamp: new Date().toISOString()
  });
});

// 2. Authentication: Login (username: admin, password: admin)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    return res.json({
      success: true,
      token: 'vhh_admin_jwt_' + Date.now(),
      user: { username: 'admin', role: 'admin' },
      message: 'Đăng nhập thành công!'
    });
  }
  return res.status(401).json({
    success: false,
    message: 'Tên đăng nhập hoặc mật khẩu không chính xác! (Mặc định: admin / admin)'
  });
});

// 3. Upload Image to Cloudinary
app.post('/api/upload', async (req, res) => {
  try {
    const { image, folder = 'dntrace_products' } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Chưa có dữ liệu hình ảnh' });
    }

    if (isCloudinaryConfigured) {
      console.log('☁️ Đang upload 1 ảnh lên Cloudinary...');
      const uploadRes = await cloudinary.uploader.upload(image, {
        folder,
        resource_type: 'auto'
      });
      console.log('✅ Upload Cloudinary thành công:', uploadRes.secure_url);
      return res.json({
        success: true,
        url: uploadRes.secure_url,
        public_id: uploadRes.public_id,
        storage: 'cloudinary',
        message: 'Đã lưu ảnh thành công lên Cloudinary!'
      });
    } else {
      return res.json({
        success: true,
        url: image,
        storage: 'local_base64',
        warning: 'Chưa cấu hình Cloudinary trong .env. Ảnh đang lưu tạm thời.',
        message: 'Đã nhận ảnh tạm thời.'
      });
    }
  } catch (err) {
    console.error('Lỗi upload ảnh lên Cloudinary:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải ảnh lên Cloudinary: ' + err.message,
      error: err.message
    });
  }
});

// 3b. Upload Multiple Images to Cloudinary (Batch Upload)
app.post('/api/upload-multiple', async (req, res) => {
  try {
    const { images, folder = 'dntrace_products' } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách hình ảnh không hợp lệ' });
    }

    if (isCloudinaryConfigured) {
      console.log(`☁️ Đang upload ${images.length} ảnh lên Cloudinary...`);
      const uploadPromises = images.map(img => 
        cloudinary.uploader.upload(img, {
          folder,
          resource_type: 'auto'
        })
      );
      const results = await Promise.all(uploadPromises);
      const urls = results.map(r => r.secure_url);

      console.log(`✅ Upload thành công ${urls.length} ảnh lên Cloudinary!`);
      return res.json({
        success: true,
        urls,
        count: urls.length,
        storage: 'cloudinary',
        message: `Đã lưu thành công ${urls.length} ảnh lên Cloudinary!`
      });
    } else {
      return res.json({
        success: true,
        urls: images,
        count: images.length,
        storage: 'local_base64',
        message: `Đã nhận ${images.length} ảnh (Lưu tạm thời Base64)`
      });
    }
  } catch (err) {
    console.error('Lỗi upload nhiều ảnh lên Cloudinary:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải danh sách ảnh lên Cloudinary: ' + err.message,
      error: err.message
    });
  }
});

// 4. GET all products
app.get('/api/products', async (req, res) => {
  try {
    if (isDbConnected) {
      const products = await Product.find().sort({ updatedAt: -1 });
      return res.json({ success: true, data: products, source: 'mongodb' });
    } else {
      return res.json({ success: true, data: inMemoryProducts, source: 'in-memory' });
    }
  } catch (err) {
    console.error('Lỗi lấy danh sách sản phẩm:', err);
    res.status(500).json({ success: false, message: 'Không thể tải danh sách sản phẩm', error: err.message });
  }
});

// 5. GET single product by ID or verificationCode
app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isDbConnected) {
      let product = null;
      if (mongoose.isValidObjectId(id)) {
        product = await Product.findById(id);
      }
      if (!product) {
        product = await Product.findOne({ verificationCode: id });
      }
      if (!product) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
      }
      return res.json({ success: true, data: product, source: 'mongodb' });
    } else {
      const product = inMemoryProducts.find(p => p._id === id || p.verificationCode === id);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
      }
      return res.json({ success: true, data: product, source: 'in-memory' });
    }
  } catch (err) {
    console.error('Lỗi lấy chi tiết sản phẩm:', err);
    res.status(500).json({ success: false, message: 'Lỗi server', error: err.message });
  }
});

// 6. POST create new product
app.post('/api/products', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.name) {
      return res.status(400).json({ success: false, message: 'Tên sản phẩm không được để trống' });
    }
    if (!payload.verificationCode) {
      payload.verificationCode = 'VCHECK-' + Date.now().toString(36).toUpperCase();
    }
    if (Array.isArray(payload.standards)) {
      payload.standards = payload.standards.filter(s => s && (s.label?.trim() || s.value?.trim()));
    }

    if (isDbConnected) {
      const existing = await Product.findOne({ verificationCode: payload.verificationCode });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Mã xác thực/VCheck này đã tồn tại!' });
      }
      const newProduct = new Product(payload);
      await newProduct.save();
      return res.status(201).json({ success: true, data: newProduct, message: 'Tạo sản phẩm thành công!' });
    } else {
      const newProduct = {
        ...payload,
        _id: 'mock_' + Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      inMemoryProducts.unshift(newProduct);
      return res.status(201).json({
        success: true,
        data: newProduct,
        message: 'Tạo sản phẩm thành công (In-Memory)! Vui lòng kết nối MongoDB để lưu vĩnh viễn.'
      });
    }
  } catch (err) {
    console.error('Lỗi tạo sản phẩm:', err);
    res.status(500).json({ success: false, message: 'Không thể tạo sản phẩm', error: err.message });
  }
});

// 7. PUT update product
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (Array.isArray(updates.standards)) {
    updates.standards = updates.standards.filter(s => s && (s.label?.trim() || s.value?.trim()));
  }
  try {
    if (isDbConnected) {
      let updatedProduct = null;
      if (mongoose.isValidObjectId(id)) {
        updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
      } else {
        updatedProduct = await Product.findOneAndUpdate({ verificationCode: id }, updates, { new: true });
      }
      if (!updatedProduct) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm để cập nhật' });
      }
      return res.json({ success: true, data: updatedProduct, message: 'Cập nhật sản phẩm thành công!' });
    } else {
      const index = inMemoryProducts.findIndex(p => p._id === id || p.verificationCode === id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm để cập nhật' });
      }
      inMemoryProducts[index] = {
        ...inMemoryProducts[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return res.json({
        success: true,
        data: inMemoryProducts[index],
        message: 'Cập nhật sản phẩm thành công (In-Memory)!'
      });
    }
  } catch (err) {
    console.error('Lỗi cập nhật sản phẩm:', err);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật', error: err.message });
  }
});

// 8. DELETE product
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isDbConnected) {
      let deleted = null;
      if (mongoose.isValidObjectId(id)) {
        deleted = await Product.findByIdAndDelete(id);
      } else {
        deleted = await Product.findOneAndDelete({ verificationCode: id });
      }
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm để xoá' });
      }
      return res.json({ success: true, message: 'Đã xoá sản phẩm thành công!' });
    } else {
      const index = inMemoryProducts.findIndex(p => p._id === id || p.verificationCode === id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm để xoá' });
      }
      inMemoryProducts.splice(index, 1);
      return res.json({ success: true, message: 'Đã xoá sản phẩm thành công (In-Memory)!' });
    }
  } catch (err) {
    console.error('Lỗi xoá sản phẩm:', err);
    res.status(500).json({ success: false, message: 'Không thể xoá sản phẩm', error: err.message });
  }
});

// 9. POST seed data manually
app.post('/api/products/seed', async (req, res) => {
  try {
    if (isDbConnected) {
      await Product.deleteMany({});
      const inserted = await Product.insertMany(defaultSeedProducts);
      return res.json({ success: true, message: 'Đã khởi tạo lại dữ liệu mẫu vào MongoDB!', count: inserted.length });
    } else {
      inMemoryProducts = JSON.parse(JSON.stringify(defaultSeedProducts)).map((p, idx) => ({
        ...p,
        _id: `mock_${idx + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      return res.json({ success: true, message: 'Đã nạp lại dữ liệu mẫu vào In-Memory Cache!', count: inMemoryProducts.length });
    }
  } catch (err) {
    console.error('Lỗi seed data:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi nạp dữ liệu mẫu', error: err.message });
  }
});

// ==========================================
// 10. QR CODE REGISTRATION ENDPOINTS
// ==========================================
app.get('/api/qr-requests', async (req, res) => {
  try {
    if (isDbConnected) {
      const requests = await QrRequest.find().sort({ createdAt: -1 });
      return res.json({ success: true, count: requests.length, data: requests });
    } else {
      return res.json({ success: true, count: inMemoryQrRequests.length, data: inMemoryQrRequests });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách yêu cầu cấp mã QR', error: err.message });
  }
});

app.post('/api/qr-requests', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.name || !payload.phone || !payload.businessName || !payload.productName) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ họ tên, tên đơn vị, tên sản phẩm và số điện thoại' });
    }
    if (isDbConnected) {
      const newReq = await QrRequest.create(payload);
      return res.status(201).json({ success: true, message: 'Gửi yêu cầu đăng ký cấp mã QR thành công!', data: newReq });
    } else {
      const newReq = {
        ...payload,
        _id: 'qr_' + Date.now(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      inMemoryQrRequests.unshift(newReq);
      return res.status(201).json({ success: true, message: 'Gửi yêu cầu đăng ký cấp mã QR thành công (In-Memory)!', data: newReq });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lưu yêu cầu cấp mã QR', error: err.message });
  }
});

app.put('/api/qr-requests/:id', async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;
  try {
    if (isDbConnected) {
      const updated = await QrRequest.findByIdAndUpdate(id, { ...(status ? { status } : {}), ...(note ? { note } : {}) }, { new: true });
      return res.json({ success: true, message: 'Cập nhật trạng thái thành công!', data: updated });
    } else {
      const item = inMemoryQrRequests.find(r => r._id === id);
      if (item) {
        if (status) item.status = status;
        if (note) item.note = note;
      }
      return res.json({ success: true, message: 'Cập nhật trạng thái thành công (In-Memory)!', data: item });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi cập nhật', error: err.message });
  }
});

app.delete('/api/qr-requests/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isDbConnected) {
      await QrRequest.findByIdAndDelete(id);
      return res.json({ success: true, message: 'Đã xoá yêu cầu thành công!' });
    } else {
      inMemoryQrRequests = inMemoryQrRequests.filter(r => r._id !== id);
      return res.json({ success: true, message: 'Đã xoá yêu cầu (In-Memory)!' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi xoá yêu cầu', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại cổng http://localhost:${PORT}`);
  console.log(`📡 API Endpoints sẵn sàng tại http://localhost:${PORT}/api/products`);
});

