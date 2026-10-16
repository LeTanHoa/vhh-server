import mongoose from 'mongoose';

const standardSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  value: { type: String, default: '' }
}, { _id: false });

const manufacturerSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  country: { type: String, default: 'Việt Nam' },
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
    default: 'CỔNG TRUY XUẤT NGUỒN GỐC VCHECK (vcheck.com.vn)'
  },
  provider: {
    type: String,
    default: 'Công ty TNHH MTV Vạn Phúc Hoa'
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
    default: '/assets/ngu_coc_huongfarm.jpg'
  },
  vcheckBanner: {
    type: String,
    default: '/assets/vcheck_banner.jpg'
  },
  ingredients: {
    type: String,
    default: ''
  },
  standards: [standardSchema],
  netWeight: {
    type: String,
    default: '500g'
  },
  expiry: {
    type: String,
    default: '12 tháng kể từ ngày sản xuất'
  },
  manufactureDate: {
    type: String,
    default: 'Xem chi tiết trên bao bì sản phẩm'
  },
  usageGuide: {
    type: String,
    default: ''
  },
  storageGuide: {
    type: String,
    default: ''
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
