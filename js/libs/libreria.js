"use strict";

// Method => è il metodo che vuoi che richieda all'API (Get/Post)
// URL => rappresenta la risorsa da richiedere all'API/Server
// Parameters => contiene i parametri della richiesta scritta come JSON
// In caso di chiamata GET, sarà sendRequest a convertire questi parametri in urlEncoded e accodarli all'URL
class Ajax {

	// Properties
	_URL = "https://randomuser.me"

	// Methods
	sendRequest(method, url, parameters = {}) {
		let options = {
			"baseURL": this._URL,  // Link del server
			"url": url, //Risorsa da richiedere 
			"method": method.toUpperCase(), //Method da usare per la richiesta (Get/Post)
			"headers": { "Accept": "application/json" }, //Consigliato
			"responseType": "json", //è il formato dei dati della risposta dell'api
			"timeout": 5000, //Tempo massimo di attesa della risposta in ms (5 Secondi)
		}
		if (method.toUpperCase() == "GET") {
			options.headers["Content-Type"] = 'application/x-www-form-urlencoded;charset=utf-8';
			options["params"] = parameters;
		}
		else {
			//JSON-Server
			options.headers["Content-Type"] = 'application/json; charset=utf-8';
			options["data"] = parameters; //Prende i parameters, li converte in url encoded e li accoda all'url
		}
		let promise = axios(options);
		return promise;
	}

	errore(err) {
		if (!err.response)
			alert("Connection Refused or Server timeout");
		else if (err.response.status == 200)
			alert("Formato dei dati non corretto : " + err.response.data);
		else
			alert("Server Error: " + err.response.status + " - " + err.response.data)
	}

}

let ajax = new Ajax()
