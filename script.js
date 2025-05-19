// Global Dominance Choropleth with Time-Slider
// Uses D3.js v7 and TopoJSON for world map

// Store match data and aggregated wins per country by year
let tennisData = [];
let winsByCountryByYear = {};
let years = [];

// Map dimensions
const width = 960;
const height = 600;

let svg, path;
const tooltip = d3.select('body')
  .append('div')
  .attr('class', 'tooltip')
  .style('opacity', 0);

document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
    d3.csv('10yearAUSOpenMatches.csv'),
    d3.json('world.geojson')
  ]).then(([data, world]) => {
    tennisData = data;
    processData();
    initMap(world);
    initSlider();
    updateChoropleth(years[0]);
  }).catch(console.error);
});

// IOC to ISO3 mapping for countries with mismatched codes
const iocToIso = {
  SUI: 'CHE'
  // add more mappings if needed
};

function processData() {
  years = Array.from(new Set(tennisData.map(d => +d.year))).sort((a, b) => a - b);

  // Initialize yearly counts
  years.forEach(y => winsByCountryByYear[y] = {});

  tennisData.forEach(d => {
    const year = +d.year;
    // Convert IOC code to ISO3
    const raw = d.winner === d.player1 ? d.country1 : d.country2;
    const country = iocToIso[raw] || raw;
    winsByCountryByYear[year][country] = (winsByCountryByYear[year][country] || 0) + 1;
  });

  // Convert to cumulative counts
  const cumulative = {};
  years.forEach((y, i) => {
    cumulative[y] = i === 0 ? {...winsByCountryByYear[y]} : {...cumulative[years[i-1]]};
    Object.entries(winsByCountryByYear[y]).forEach(([c, cnt]) => {
      cumulative[y][c] = (cumulative[y][c] || 0) + cnt;
    });
  });
  winsByCountryByYear = cumulative;
}

function initMap(world) {
  svg = d3.select('#choropleth-map-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  path = d3.geoPath().projection(
    d3.geoNaturalEarth1().scale(160).translate([width/2, height/2])
  );

  const countries = world.features;

  svg.append('g')
    .selectAll('path')
    .data(countries)
    .enter().append('path')
    .attr('class', 'country')
    .attr('d', path)
    .attr('fill', '#eee')
    .on('mouseover', function(event, d) {
      d3.select(this).style('fill-opacity', 0.7);
      const iso = d.id;  // feature.id is ISO3 code
      const name = d.properties.name;
      showTooltip(event, iso, name);
    })
    .on('mouseout', function() {
      d3.select(this).style('fill-opacity', 1);
      tooltip.transition().duration(200).style('opacity', 0);
    });
}

function initSlider() {
  const slider = d3.select('#year-slider')
    .attr('min', years[0])
    .attr('max', years[years.length-1])
    .attr('value', years[0]);

  d3.select('#year-display').text(years[0]);

  slider.on('input', function() {
    const y = +this.value;
    d3.select('#year-display').text(y);
    updateChoropleth(y);
  });
}

function updateChoropleth(year) {
  const data = winsByCountryByYear[year] || {};
  const maxVal = d3.max(Object.values(data)) || 1;
  const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxVal]);

  svg.selectAll('.country')
    .transition().duration(500)
    .style('fill', d => {
      const code = d.id;  // use feature.id for ISO3 code
      const val = data[code];
      return val != null ? color(val) : '#eee';
    });
}

function showTooltip(event, iso, name) {
  const year = +d3.select('#year-slider').property('value');
  const wins = winsByCountryByYear[year][iso] || 0;
  tooltip.transition().duration(200).style('opacity', 1);
  tooltip.html(`<strong>${name}</strong><br/>Wins: ${wins}`)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY - 28) + 'px');
}
