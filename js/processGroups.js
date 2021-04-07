var svg;
var pathGuate;
var rScale;
var rasterBounds;
var focusWidth;

var groupNames = [
            "Achi",
            "Akateka",
            "Awakateka",
            "Ch'orti'",
            "Chalchiteka",
            "Chuj",
            "Itza'",
            "Ixil",
            "Jakalteko/Popti'",
            "K'iche'",
            "Kaqchiquel",
            "Mam",
            "Mopan",
            "Poqomam",
            "Poqomchi'",
            "Q'anjob'al",
            "Q'eqchi'",
            "Sakapulteka",
            "Sipakapense",
            "Tektiteka",
            "Tz'utujil",
            "Uspanteka",
            "Maya",
            "Garífuna",
            "Xinka",
            "Afrodescendiente/Creole/Afromestizo",
            "Ladina(o)",
            "Extranjera(o)",
            "total_grupos",
            "Total de personas"
      ];

function loadData(){
    Promise.all([
      d3.json("data/ethnic_groups_municipios.geojson"),
      d3.json("data/municipios_topo.json"),
      d3.json("data/focusArea_extent.geojson"),
      d3.json("data/raster_extent.geojson"),
      d3.json("data/countries_topo.json"),
      d3.json("data/violationsByMunicipio.geojson")
    ])
    .then(function([groupsJSON,municipiosTOPO,focusAreaJSON,rasterAreaJSON,countriesTOPO,violationsJSON]){
        var groupsData = groupsJSON.features;
        var municipios = topojson.feature(municipiosTOPO, municipiosTOPO.objects.municipios).features;
        var focusBox = focusAreaJSON;
        var rasterBox = rasterAreaJSON;
        var countries = topojson.feature(countriesTOPO, countriesTOPO.objects.countries).features;
        var violations = violationsJSON;

        positionMap(municipios,focusBox,rasterBox,countries);
        drawDotDensity(groupsData);
        drawViolations(violations);

    });
}

//creates full screen base map and lines up raster and vector layers
function positionMap(municipios,focusBox,rasterBox,countries){

    w = $("div.map").width();
    h = $("div.map").height();

    var margin = {top: 5, right: 5, bottom: 5, left: 5}

    //create guatemalaprojection
    const centerLocation = {
      "longitude": -90.2299,
      "latitude": 15.7779
    };
    //albers centered on guatemala
    const albersGuate = d3.geoConicEqualArea()
                      .parallels([14.8,16.8]) 
                      .rotate([centerLocation["longitude"]*-1,0,0])
                      .center([0,centerLocation["latitude"]])
                      .fitExtent([[margin.left,margin.top],[w-margin.right,h-margin.bottom]], focusBox);

    //path generator
    pathGuate = d3.geoPath()
             .projection(albersGuate);

    //store width of focus area to scale vectors
    var computedBox = pathGuate.bounds(focusBox)
    focusWidth = computedBox[1][0] - computedBox[0][0];

    svg = d3.select("div.map")
              .append("svg")
              .attr("class", "magic")
              .attr("viewBox", `0 0 ${w} ${h}`)
              .attr("overflow", "visible")
              .style("position","relative")
              .style("z-index", 1)


    //calculate raster extent percentages
    rasterBounds = pathGuate.bounds(rasterBox);
    var rasterWidth = (rasterBounds[1][0] - rasterBounds[0][0])/w*100;
    var rasterOrigin = [rasterBounds[0][0]/w*100,rasterBounds[0][1]/h*100];

    //append raster background
    svg.append("image")
            .attr("href", "img/hs_light.jpg")
            .attr("x", rasterOrigin[0]+"%")
            .attr("y", rasterOrigin[1]+"%")
            .attr("width", rasterWidth + "%")
            .attr("transform", "translate(0,5)");

    //draw countries
    var countryBorders = svg.append("g")
                            .selectAll(".country")
                            .data(countries)
                            .enter()
                            .append("path")
                                .attr("d", pathGuate)
                                .attr("class", "country");


    // //draw labels as HTML so it doesn't scale with viewbox
    // var countriesLabels = d3.select("div.map").append("div").attr("class", "labels")
    //                             .selectAll(".country")
    //                             .data(countries)
    //                             .enter()
    //                             .append("p")
    //                             .text(d=>d.properties["NAME"])
    //                                 .style("left", function(d){
    //                                     return pathGuate.centroid(d)[0]/w*100+"%";
    //                                 })
    //                                 .style("top", function(d){
    //                                     return pathGuate.centroid(d)[1]/h*100+"%";
    //                                 });

    // console.log(countriesLabels);



}


function drawDotDensity(groupsData){

    //draw municipios
    var municipios = svg.append("g")
                            .selectAll(".municipio")
                            .data(groupsData)
                            .enter()
                            .append("path")
                                .attr("d", pathGuate)
                                .attr("class", "municipio");

}

function drawViolations(violations){

    rScale = d3.scaleSqrt()
                  .domain([0,5000])
                  .range([0, focusWidth/18]);

    var filtered = violations.features.filter(function(feature){
        if(feature.properties["violations"]) return feature;
    });

    var violationsPacked = makeSiblingPack(filtered,"violations","c_tot");
    var violationsSpread =  applySimulation(violationsPacked);

    //add spread bubbles
    var circleGroups = svg.append("g")
                           .selectAll(".circleGroups")
                               .data(violationsSpread)
                               .enter()
                               .append("g")
                               .attr("transform", d => `translate(${d.x} ${d.y})`);

     var outerCircles = circleGroups.append("circle")
               .attr("class", "outerCircle")
               .attr("r", d => d.properties["violations_mama"].r)
               .attr("fill", "none")
               .attr("stroke", "#fff")
               .attr("stroke-width", 0.1);

     circleGroups.each(function(d){  
           for(i=0;i<d.properties["violations_siblings"].length;i++){
               d3.select(this).append("circle")
                                 .attr("class", "innerCircle")
                                   .attr("cx", d=>d.properties["violations_siblings"][i].x)
                                   .attr("cy", d=>d.properties["violations_siblings"][i].y)
                                   .attr("r", d=>d.properties["violations_siblings"][i].r-0.1)
                                   .attr("fill", "#fff");
           }
     });


}

function makeSiblingPack(features,attribute,radiusAttribute){
  
  for(var feature of features){

    if(feature.properties[attribute]){

      feature.properties[attribute+"_siblings"] = [];

      for(var i=0; i < feature.properties[attribute].length; i++){
          var violation = feature.properties[attribute][i];
          //filter
          if(violation["n_year"] < 1985){
              feature.properties[attribute+"_siblings"].push({
                "uniqueId": i,
                "r": rScale(violation["c_tot"])
              });
          }
      }

     feature.properties[attribute+"_siblings"] = d3.packSiblings(feature.properties[attribute+"_siblings"]);
     feature.properties[attribute+"_mama"] = d3.packEnclose(feature.properties[attribute+"_siblings"]);
    } 
  }

  var nonZero = features.filter(function(feature){
    if(feature.properties[attribute+"_siblings"].length>0) return feature;
  });

  return nonZero;
}

function applySimulation(nodes){
    var nodePadding = 0.05;
    const simulation = d3.forceSimulation(nodes)
    // .force("cx", d3.forceX().x(d => w / 2).strength(0.005))
    // .force("cy", d3.forceY().y(d => h / 2).strength(0.005))
    .force("x", d3.forceX().x(d => pathGuate.centroid(d) ? pathGuate.centroid(d)[0] : 0).strength(1))
    .force("y", d3.forceY().y(d => pathGuate.centroid(d) ? pathGuate.centroid(d)[1] : 0).strength(1))
    // .force("charge", d3.forceManyBody().strength(-1))
    .force("collide", d3.forceCollide().radius(d => d.properties["violations_mama"].r  + nodePadding).strength(1))
    .stop();

    let i = 0; 
    while (simulation.alpha() > 0.01 && i < 200) {
      simulation.tick(); 
      i++;
    }

    return simulation.nodes();
}

loadData();
