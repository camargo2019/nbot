/*
    Gabriel Camargo - CMR Services
      Bot de envios de mensagens
*/
const fs = require('fs');
const http = require('https');
const mysql = require('mysql');
const moment = require('moment-timezone');
const fetch = require('node-fetch');
const {Client, LocalAuth, MessageMedia} = require('whatsapp-web.js');
const {LocalStorage} = require("node-localstorage");

var con = mysql.createConnection({
    host: "",
    user: "",
    password: "",
    database: ""
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

var client = new Client({
    puppeteer: {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: false
    },
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    var localStorage = new LocalStorage('./data'); 
    localStorage.setItem('qrCode', qr)
});

client.on('ready', () => {
    var localStorage = new LocalStorage('./data'); 
    localStorage.setItem('state', "online") 
    localStorage.setItem('send', "no") 
    localStorage.setItem('qrCode', "");
});

client.on('disconnected', () => {
    var localStorage = new LocalStorage('./data');
    localStorage.setItem('state', "desconectado") 
});

const DOMAIN = "";

con.connect(async function(err) {
    if (err){
        console.log("-> Atenção não foi possivel inicar o bot.");
        console.log("-> Verique as informações da database.");
    }else{
        console.log("-> nCMR Bot iniciado com sucesso!");
        const localStorage = new LocalStorage('./data');
        localStorage.setItem("status_client", "desligado");

        const requests = async (req, res) => {
            try{
                res.writeHead(200, {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': true,    'Content-Type': 'text/json'});

                if(req.url == "/qr-code"){
                    if(localStorage.getItem("status_client") == "ligado"){
                        const qrCode = localStorage.getItem('qrCode');
                        if(qrCode.length <= 0){
                            res.end(`{"error": "yes", "msg": "dispositivo já está conectado."}`);
                        }else{
                            res.end(`{"error": "no", "qr_code": "${qrCode}"}`);
                        }
                        localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                    }else{
                        client.initialize();
                        localStorage.setItem("status_client", "ligado");
                        localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                        const qrCode = localStorage.getItem('qrCode');
                        if(qrCode.length <= 0){
                            res.end(`{"error": "yes", "msg": "dispositivo já está conectado."}`);
                        }else{
                            res.end(`{"error": "no", "qr_code": "${qrCode}"}`);
                        }
                    }
                }else if(req.url == "/restart"){
                    try{
                        if(localStorage.getItem("status_client") == "ligado"){
                            await client.destroy();
                            console.log("Desligando....");
                            client.initialize();
                            console.log("Ligando....");
                            res.end(`{"error": "no", "msg": "Reiniciado com sucesso!"}`);
                            localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                        }else{
                            res.end(`{"error": "yes", "msg": "Bot não está ligado!"}`);
                        }
                    }catch{
                        res.end(`{"error": "yes", "msg": "Aguarde um pouco para estar reiniciado o bot!"}`);
                        localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                    }
                }else if(req.url == "/deslogar"){
                    try{
                        if(localStorage.getItem("status_client") == "ligado"){
                            await client.destroy();
                            console.log("Desligando....");
                            await fs.rmSync('.wwebjs_auth', { recursive: true, force: true });
                            localStorage.setItem('state', "desconectado");
                            client.initialize();
                            console.log("Ligando....");
                            res.end(`{"error": "no", "msg": "Deslogado com sucesso!"}`);
                            localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                        }else{
                            res.end(`{"error": "yes", "msg": "Bot não está ligado!"}`);
                        }
                    }catch{
                        res.end(`{"error": "yes", "msg": "Aguarde um pouco para estar deslogando do bot!"}`);
                        localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                    }
                    
                }else{
                    const logado = localStorage.getItem("state");
                    if(logado == "online"){
                        if(req.url == "/get-groups"){
                            const grupos = {};
                            grupos["error"] = "no";
                            grupos["grupos"] = [];
                            const chats = await client.getChats();
                            chats.forEach(data => {
                                if(data.isGroup){
                                    grupos["grupos"].push({"id": data.id._serialized, "name": data.name});
                                }
                            });
                            res.end(JSON.stringify(grupos));
                        }else if(req.url == "/send-msg" && req.method == "POST"){
                            var body = ''
                            req.on('data', function(data){
                                body += data
                            });
                            
                            req.on('end', async function() {
                                res.end(`{"error": "no", "msg": As mensagem estão sendo enviadas!"}`);
                                
                                var json = JSON.parse(body);
                                if(localStorage.getItem("status_client") == "desligado"){
                                    client.initialize();
                                    localStorage.setItem("status_client", "ligado");
                                    localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));                            
                                }
                                setTimeout(async () => {
                                    await delay(30000);
                                    const qrCode = localStorage.getItem('qrCode');
                                    if(qrCode.length <= 0){
                                        if(json.descricao.length >= 1 && json.mensagem == 0){
                                            const response = await fetch(DOMAIN+'/api/ajax/get-all-grupo-envio');
                                            const data = await response.json();
                                            for (const gp of data.grupos) {
                                                localStorage.setItem('send', "yes") 
                                                localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                await client.sendMessage(gp, json.descricao);  
                                                localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                localStorage.setItem('send', "no") 
                                            }
                                        }else if(json.mensagem){
                                            localStorage.setItem('send', "yes") 
                                            const params = new URLSearchParams();
                                            params.append('id', json.mensagem);
                                            const response = await fetch(DOMAIN+'/api/ajax/get-all-mensagem-envio', {method: 'POST', body: params});
                                            const data = await response.json();

                                            if(json.descricao.length >= 1){
                                                for (const gp of data.grupos) {
                                                    localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                    await client.sendMessage(gp, json.descricao);  
                                                    localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                }
                                            }
                                            const hours = moment().tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm');
                                            await con.query("INSERT INTO cmr_logs (mensagem_id, date_time, status, produto_stop) VALUES (?)", [[json.mensagem, hours, "Processando", '']])

                                            for (const produto of data.produtos){
                                                
                                                var continua = true;
                                                var sair = false;

                                                await con.query("SELECT id FROM cmr_logs WHERE mensagem_id = ? and date_time = ? and status = ? ", [json.mensagem, hours, 'Pausado'], async function (err, result, fields) {
                                                    if(result.length >= 1){
                                                        await con.query("UPDATE cmr_logs SET produto_stop = ? WHERE id = ?", [produto.id, result[0].id]);
                                                        sair = true;
                                                    }else{
                                                        continua = false;
                                                    }
                                                    
                                                });

                                                while (continua){
                                                    await delay(100);
                                                }

                                                if(sair){
                                                    break;
                                                }

                                                for (const gp of data.grupos) {
                                                    try {
                                                        for (video of JSON.parse(produto.files_video)){
                                                            await delay(5000);
                                                            const media = await MessageMedia.fromUrl(DOMAIN+"/uploads/"+video);
                                                            localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                            await client.sendMessage(gp, media);
                                                            localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                        }
                                                    } catch { }

                                                    try {
                                                        for (img of JSON.parse(produto.files_img)){
                                                            await delay(5000);
                                                            const media = await MessageMedia.fromUrl(DOMAIN+"/uploads/"+img);
                                                            localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                            await client.sendMessage(gp, media);
                                                            localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                        }
                                                    } catch { }

                                                    try {
                                                        if(produto.texto.length >= 1){
                                                            await delay(5000);
                                                            localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                            await client.sendMessage(gp, produto.texto);  
                                                            localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                        }
                                                    } catch { }
                                                }
                                                
                                            }

                                            localStorage.setItem('send', "no") 
                                            /* Finalizar msg de envio */
                                            await con.query("UPDATE cmr_logs SET status='Enviado' WHERE mensagem_id = ? and date_time = ? and status = ? and produto_stop = '' ORDER BY id DESC", [json.mensagem, hours, "Processando"]);
                                        }
                                    }
                                }, 300);
                            });
                        }else if(req.url == "/continuar-post" && req.method == "POST"){
                            var body = ''
                            req.on('data', function(data){
                                body += data
                            });
                            
                            req.on('end', async function() {
                                res.end(`{"error": "no", "msg": As mensagem estão sendo enviadas!"}`);
                                
                                var json = JSON.parse(body);
                                if(localStorage.getItem("status_client") == "desligado"){
                                    client.initialize();
                                    localStorage.setItem("status_client", "ligado");
                                    localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));                            
                                }
                                setTimeout(async () => {
                                    localStorage.setItem('send', "yes") 
                                    await delay(30000);
                                    const qrCode = localStorage.getItem('qrCode');
                                    if(qrCode.length <= 0){
                                        if(json.continuar_id){
                                            await con.query("SELECT * FROM cmr_logs WHERE id = ?", json.continuar_id, async function(err, result, fields){
                                                const params = new URLSearchParams();
                                                params.append('id', result[0].mensagem_id);
                                                const response = await fetch(DOMAIN+'/api/ajax/get-all-mensagem-envio', {method: 'POST', body: params});
                                                const data = await response.json();
                                                const hours = moment().tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm');
                                                await con.query("UPDATE cmr_logs SET status='Processando' WHERE id = ?", [result[0].id])

                                                var produto_continua = false;

                                                for (const produto of data.produtos){
                                                    
                                                    var continua = true;
                                                    var sair = false;
                                                    

                                                    await con.query("SELECT id FROM cmr_logs WHERE id = ? and status = ? ", [result[0].id, 'Pausado'], async function (err, resulta, fields) {
                                                        if(resulta.length >= 1){
                                                            await con.query("UPDATE cmr_logs SET produto_stop = ? WHERE id = ?", [produto.id, resulta[0].id]);
                                                            sair = true;
                                                        }else{
                                                            continua = false;
                                                        }
                                                        
                                                    });

                                                    while (continua){
                                                        await delay(100);
                                                    }

                                                    if(sair){
                                                        break;
                                                    }
                                                    
                                                    if(produto_continua === false){
                                                        if(parseInt(result[0].produto_stop) == parseInt(produto.id)){
                                                            produto_continua = true;
                                                        }
                                                    }

                                                    if(produto_continua){
                                                        for (const gp of data.grupos) {
                                                            try {
                                                                for (video of JSON.parse(produto.files_video)){
                                                                    await delay(5000);
                                                                    const media = await MessageMedia.fromUrl(DOMAIN+"/uploads/"+video);
                                                                    localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                                    await client.sendMessage(gp, media);
                                                                    localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                                }
                                                            } catch { }

                                                            try {
                                                                for (img of JSON.parse(produto.files_img)){
                                                                    await delay(5000);
                                                                    const media = await MessageMedia.fromUrl(DOMAIN+"/uploads/"+img);
                                                                    localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                                    await client.sendMessage(gp, media);
                                                                    localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                                }
                                                            } catch { }

                                                            try {
                                                                if(produto.texto.length >= 1){
                                                                    await delay(5000);
                                                                    localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                                    await client.sendMessage(gp, produto.texto);  
                                                                    localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                                                }
                                                            } catch { }
                                                        }
                                                    }
                                                    
                                                }

                                                /* Finalizar msg de envio */
                                                localStorage.setItem('send', "no") 
                                                await con.query("UPDATE cmr_logs SET status='Enviado' WHERE id = ? and status = ?", [result[0].id, "Processando"]);
                                            });
                                        }
                                    }
                                }, 300);
                            });
                        }else if(req.url == "/pedido-recebido" && req.method == "POST"){
                            var body = ''
                            req.on('data', function(data){
                                body += data;
                            });
                            
                            req.on('end', async function() {
                                res.end(`{"error": "no", "msg": As mensagem estão sendo enviadas!"}`);
                                
                                var json = JSON.parse(body);
                                if(localStorage.getItem("status_client") == "desligado"){
                                    client.initialize();
                                    localStorage.setItem("status_client", "ligado");
                                    localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));                            
                                }
                                setTimeout(async () => {
                                    localStorage.setItem('send', "yes") 
                                    await delay(30000);
                                    const qrCode = localStorage.getItem('qrCode');
                                    if(qrCode.length <= 0){
                                        if(json.texto && json.numero && json.pdf){
                                            const media = await MessageMedia.fromUrl(DOMAIN+"/pdf/view/"+json.pdf+".pdf");
                                            localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                            await client.sendMessage(json.numero, json.texto);
                                            await delay(5000);
                                            await client.sendMessage(json.numero, media);
                                            localStorage.setItem("status_client_hora", String(moment().toDate().getTime()));
                                        }
                                    }
                                    localStorage.setItem('send', "no") 
                                }, 300);
                            });
                        }
                    }
                }
            } catch {
                res.end(`{"error": "yes", "msg": "Aguarde alguns minutos!"}`);
            }
        }
        
        setInterval(function(){
            try{
                if(localStorage.getItem("status_client") == "ligado"){
                    if(moment(parseInt(localStorage.getItem("status_client_hora"))).add(5, 'm').toDate().getTime() < moment().toDate().getTime()){
                        if(localStorage.getItem("send") == "no"){
                            client.destroy();
                            localStorage.setItem("status_client", "desligado");
                        }
                    }
                }
            }catch{} 
        }, 300000);

		const options = {
		  key: fs.readFileSync('privkey.pem'),
		  cert: fs.readFileSync('cert.pem')
		};

        const server = http.createServer(options, requests);
        server.listen(6588);
    }
});
