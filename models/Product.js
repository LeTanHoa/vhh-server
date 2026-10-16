import mongoose from 'mongoose';

const standardSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  value: { type: String, default: '' }
}, { _id: false });

const manufacturerSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  country: { type: String, default: 'Việt Nam' },
  attpCode: { type: String, default: '' },
  businessId: { type: String, default: '' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  website: { type: String, default: '' }
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên sản phẩm là bắt buộc'],
    trim: true
  },
  system: {
    type: String,
    default: 'CỔNG TRUY XUẤT NGUỒN GỐC DNTRACE (dntrace.com)'
  },
  provider: {
    type: String,
    default: 'dntrace.com'
  },
  status: {
    type: String,
    default: 'ĐÃ XÁC THỰC THÀNH CÔNG'
  },
  verificationCode: {
    type: String,
    required: [true, 'Mã định danh/xác thực là bắt buộc'],
    unique: true,
    trim: true
  },
  image: {
    type: String,
    default: '/assets/keo_dua_ngoc_hai_spec.png'
  },
  gallery: {
    type: [String],
    default: []
  },
  vcheckBanner: {
    type: String,
    default: '/assets/dntrace_logo.jpg'
  },
  ingredients: {
    type: String,
    default: ''
  },
  tcbsp: {
    type: String,
    default: ''
  },
  standardCode: {
    type: String,
    default: ''
  },
  warning: {
    type: String,
    default: ''
  },
  story: {
    type: String,
    default: ''
  },
  rawMaterials: {
    type: String,
    default: ''
  },
  standards: [standardSchema],
  netWeight: {
    type: String,
    default: 'đang cập nhật'
  },
  expiry: {
    type: String,
    default: 'đang cập nhật'
  },
  manufactureDate: {
    type: String,
    default: 'Xem trên bao bì'
  },
  usageGuide: {
    type: String,
    default: 'xem chi tiết trên bao bì'
  },
  storageGuide: {
    type: String,
    default: 'Bảo quản ở nơi khô ráo thoáng mát tránh ánh nắng trực tiếp'
  },
  manufacturer: {
    type: manufacturerSchema,
    default: () => ({})
  },
  mapEmbed: {
    type: String,
    default: ''
  },
  benefits: {
    type: [String],
    default: []
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;

