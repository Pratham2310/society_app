const QRCode=require("qrcode");
/*generate qr code  as base 64*/

exports.generateQR=async (payload)=>{
    try{
        const qrData=JSON.stringify(payload);
        const qr = await QRCode.toDataURL(qrData);
        return qr
    }catch(err){
        throw err;
    }
};