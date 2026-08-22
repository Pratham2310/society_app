const QRCode=require("qrcode");

/*generate qr code as base 64*/
exports.generateQR=async (payload)=>{
    const qrData=JSON.stringify(payload);
    return QRCode.toDataURL(qrData);
};
