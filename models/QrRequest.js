import mongoose from 'mongoose';

const qrRequestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Họ tên người đăng ký là bắt buộc'],
    trim: true
  },
  businessName: {
    type: String,
    required: [true, 'Tên đơn vị / Cơ sở sản xuất là bắt buộc'],
    trim: true
  },
  productName: {
    type: String,
    required: [true, 'Tên sản phẩm đăng ký là bắt buộc'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Số điện thoại liên hệ là bắt buộc'],
    trim: true
  },
  email: {
    type: String,
    default: '',
    trim: true
  },
  address: {
    type: String,
    default: '',
    trim: true
  },
  qrType: {
    type: String,
    default: 'Tem Truy Xuất Nguồn Gốc (QR Code)',
  },
  quantity: {
    type: String,
    default: '1.000 - 5.000 tem',
  },
  note: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'approved', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

const QrRequest = mongoose.models.QrRequest || mongoose.model('QrRequest', qrRequestSchema);

export default QrRequest;
