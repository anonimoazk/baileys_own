import { baileysManager } from '../services/baileysManager.js';
import qrcode from 'qrcode';
export const createInstance = async (req, res) => {
    const { instanceId } = req.body;
    if (!instanceId) {
        return res.status(400).json({ error: 'instanceId is required' });
    }
    try {
        // 2. Limpeza preventiva (Se já existir conexão viva, encerra graciosamente sem deletar sessão)
        try {
            if (baileysManager.getInstance(instanceId)) {
                await baileysManager.deleteInstance(instanceId, false); // logout=false
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        catch (e) {
            // Se não existir, apenas ignora o erro e segue
        }
        // 3. Cria a nova instância
        const instance = await baileysManager.createInstance(instanceId);
        return res.status(201).json({
            message: 'Initializing',
            instanceId: instance.instanceId
        });
    }
    catch (error) {
        // 6. Tratamento de erro único
        return res.status(500).json({ error: error.message });
    }
};
export const getInstanceStatus = (req, res) => {
    const { instanceId } = req.params;
    const instance = baileysManager.getInstance(instanceId);
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    res.status(200).json({ instanceId: instance.instanceId, status: instance.status });
};
// Função auxiliar para aguardar o QR code com retry
const waitForQRCode = async (instanceId, maxWaitTime = 30000) => {
    const startTime = Date.now();
    const pollInterval = 1000; // Verificar a cada 1 segundo
    while (Date.now() - startTime < maxWaitTime) {
        const instance = baileysManager.getInstance(instanceId);
        if (instance && instance.qr) {
            return instance.qr;
        }
        // Aguardar 1 segundo antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    return null; // Timeout - QR code não foi gerado
};
export const getInstanceQR = async (req, res) => {
    const { instanceId } = req.params;
    const instance = baileysManager.getInstance(instanceId);
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    try {
        // Aguarda o QR code por até 30 segundos
        const qrString = await waitForQRCode(instanceId, 30000);
        if (!qrString) {
            return res.status(404).json({ error: 'QR code not available - timeout' });
        }
        // Converte a string do QR code nativa do Baileys para uma imagem Data URL
        const qrImage = await qrcode.toDataURL(qrString);
        res.status(200).json({ qr: qrImage });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
export const sendMessage = async (req, res) => {
    const { instanceId } = req.params;
    const { to, text } = req.body;
    if (!to || !text) {
        return res.status(400).json({ error: 'to and text are required' });
    }
    const instance = baileysManager.getInstance(instanceId);
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    try {
        const result = await instance.sendTextMessage(to, text);
        res.status(200).json({ success: true, result });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
export const deleteInstance = async (req, res) => {
    const { instanceId } = req.params;
    try {
        await baileysManager.deleteInstance(instanceId);
        res.status(200).json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
export const sendMediaMessage = async (req, res) => {
    const { instanceId } = req.params;
    const { to, type, url, caption, fileName, mimetype } = req.body;
    const instance = baileysManager.getInstance(instanceId);
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    try {
        const result = await instance.sendMedia(to, type, url, caption, fileName, mimetype);
        res.status(200).json({ success: true, result });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
export const getProfilePicture = async (req, res) => {
    const { instanceId, number } = req.params;
    if (!number) {
        return res.status(400).json({ error: 'number is required' });
    }
    const instance = baileysManager.getInstance(instanceId);
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    try {
        const url = await instance.getProfilePicture(number);
        return res.status(200).json({ url });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
export const listInstances = (req, res) => {
    const instances = baileysManager.listInstances();
    res.status(200).json(instances);
};
export const reconnectInstance = async (req, res) => {
    const { instanceId } = req.params;
    const instance = baileysManager.getInstance(instanceId);
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    try {
        await instance.reconnect();
        return res.status(200).json({ success: true, message: 'Reconexão iniciada' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
//# sourceMappingURL=instanceController.js.map