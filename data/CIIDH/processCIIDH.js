var fs = require('fs');
const neatCsv = require('neat-csv');
var municipios = JSON.parse(fs.readFileSync("../comprehensive_municipios.geojson"));

console.log("Processing raw CIIDH data...");

//load raw CIIDH data
fs.readFile("withMunicipioRaw.csv", function(err,violations){
	if(err) console.log(err);
	Promise.all([neatCsv(violations)]).then(function(data){
		processViolations(data[0]);
	})
});

function processViolations(violations){
	for(var municipio of municipios.features){
		var code = municipio.properties["codigo_mun"];
		var municipioViolations = [];
		var municipioTotalAffected = 0;
		for(var violation of violations){
			var codigo = violation["municipio_code"];
			if(code == codigo){
				municipioViolations.push(violation);
				municipioTotalAffected+=violation["c+tot"];
			}
		}
		//if there are violations add to municipio as property
		if(municipioViolations.length>0){
			municipio.properties["violations"] = municipioViolations;
			municipio.properties["total_affected"] = municipioTotalAffected;
		}
	}
	writeFile(municipios);
}

function writeFile(data){
	fs.writeFileSync("violationsByMunicipio.geojson", JSON.stringify(data));
}