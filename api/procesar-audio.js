import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
    api: { bodyParser: false } // Desactivamos el lector plano para recibir archivos pesados de video
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const form = new IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ decision: 'CLIP', error: 'Error leyendo archivo' });

        const archivoVideo = files.video?.[0] || files.video;
        if (!archivoVideo) return res.status(400).json({ decision: 'CLIP', error: 'No hay video' });

        const GROQ_API_KEY = "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";

        try {
            // 1. Tomamos el archivo multimedia guardado temporalmente en el servidor
            const streamDeAudio = fs.createReadStream(archivoVideo.filepath);
            
            const formDataAudio = new FormData();
            formDataAudio.append('file', streamDeAudio, archivoVideo.originalFilename);
            formDataAudio.append('model', 'whisper-large-v3'); // El oído ultra veloz de Groq
            formDataAudio.append('language', 'es');

            // 2. Transcripción: Groq escucha el audio y nos devuelve el texto en un segundo
            const respuestaWhisper = await fetch("https://groq.com", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
                body: formDataAudio
            });

            const datosTrans = await respuestaWhisper.json();
            const textoHablado = datosTrans.text || "";

            // 3. Análisis de Contenido: Le pasamos el texto a Llama 3 para que tome la decisión editorial
            const respuestaLlama = await fetch("https://groq.com", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama3-8b-8192",
                    messages: [
                        {
                            role: "system",
                            content: "Eres un editor de video experto. Analiza el texto transcrito de un clip en bruto. Responde ÚNICAMENTE con una palabra en mayúsculas: 'HOOK' si el texto denota un gancho de introducción potente (ej: inicia con promesas, enganches, 'si quieres aprender...', etc.), 'TRASH' si el locutor se equivoca, tartamudea, pide repetir la toma o hay errores evidentes, o 'CLIP' si es desarrollo normal o contenido base."
                        },
                        {
                            role: "user",
                            content: `Analiza esta transcripción: "${textoHablado}"`
                        }
                    ],
                    temperature: 0.1
                })
            });

            const datosLlama = await respuestaLlama.json();
            const decisionFinal = datosLlama.choices?.[0]?.message?.content?.toUpperCase() || "CLIP";

            return res.status(200).json({ decision: decisionFinal, transcripcion: textoHablado });

        } catch (e) {
            return res.status(500).json({ decision: 'CLIP', error: e.message });
        }
    });
}
