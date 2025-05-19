// Global Dominance Choropleth with Time-Slider
// Uses D3.js v7 and TopoJSON for world map

// Store match data and aggregated wins per country by year
let tennisData = [];
let winsByCountryByYear = {};
let years = [];

// --- BEGIN Radar Duel Variables ---
let allPlayerNames = []; // To be populated after data load
const radarChartWidth = 380; // Width for each radar chart SVG - Increased from 300
const radarChartHeight = 380; // Height for each radar chart SVG - Increased from 300
const radarMargin = { top: 70, right: 70, bottom: 70, left: 70 }; // Increased margins for labels
const radarEffectiveWidth = radarChartWidth - radarMargin.left - radarMargin.right;
const radarEffectiveHeight = radarChartHeight - radarMargin.top - radarMargin.bottom;

const radarChartStatsMeta = [
    { axis: "1st Srv %", key: "firstServe", unit: "%", max: 1.0, isPercentage: true },
    { axis: "Aces", key: "ace", unit: "avg", max: 20, isPercentage: false }, // Corrected key: "ace"
    { axis: "DFs", key: "double", unit: "avg", max: 10, isPercentage: false }, // Corrected key: "double"
    { axis: "BP Conv %", key: "break", unit: "%", max: 1.0, isPercentage: true }, // Corrected key: "break"
    { axis: "Net Pts Won %", key: "net", unit: "%", max: 1.0, isPercentage: true } // Corrected key: "net"
];
// --- END Radar Duel Variables ---

// Map dimensions
const mapWidth = 960; // Renamed for clarity
const mapHeight = 600; // Renamed for clarity

let svg, path; // For the map
const mapTooltip = d3.select('body') // Renamed for clarity
  .append('div')
  .attr('class', 'tooltip')
  .style('opacity', 0);

// Bracket dimensions and SVG
const bracketMargin = { top: 20, right: 150, bottom: 20, left: 250 }; // Increased left margin
const bracketWidth = 1800 - bracketMargin.left - bracketMargin.right; // Adjusted width, consider increasing total SVG width if needed
const bracketHeight = 1000 - bracketMargin.top - bracketMargin.bottom; // Effective height for tree layout
let bracketSvg; // Will be assigned in initBracketDisplay
const bracketTooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip bracket-tooltip')
    .style('opacity', 0);

// --- BEGIN Bracket Explorer Variables ---
let nodeUniqueId = 0;
const transitionDuration = 750;
let globalRoot; // Stores the D3 hierarchy root for the current bracket

// Helper for diagonal paths (curved links) for the horizontal tree
function diagonal(d) {
    // d is a link object {source: node, target: node}
    // For horizontal tree: source.y is x-coord, source.x is y-coord
    return `M${d.source.y},${d.source.x}C${(d.source.y + d.target.y) / 2},${d.source.x} ${(d.source.y + d.target.y) / 2},${d.target.x} ${d.target.y},${d.target.x}`;
}
// --- END Bracket Explorer Variables ---

document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
    d3.csv('10yearAUSOpenMatches.csv'),
    d3.json('world.geojson')
  ]).then(([data, world]) => {
    tennisData = data;
    processData(); // Populates 'years' array
    allPlayerNames = extractAllPlayerNames(tennisData); // Extract player names

    // Choropleth Map
    initMap(world);
    initSlider(); // For the map
    updateChoropleth(years[0]);

    // Bracket Explorer
    initBracketControls();
    initBracketDisplay();
    // Initial render for the bracket with default year and gender
    if (years.length > 0) {
      renderBracket(years[0], 'm'); // Default to first year, men's
    }

    // Radar Duel
    initRadarDuelControls();
    updateRadarDuelVisualization(); // Initial call

  }).catch(console.error);
});

// IOC to ISO3 mapping for countries with mismatched codes
const iocToIso = {
  SUI: 'CHE',
  GBR: 'GBR', // Great Britain
  USA: 'USA', // United States
  ESP: 'ESP', // Spain
  FRA: 'FRA', // France
  SRB: 'SRB', // Serbia
  ARG: 'ARG', // Argentina
  CRO: 'CRO', // Croatia
  CHI: 'CHI', // Chile
  CYP: 'CYP', // Cyprus
  RUS: 'RUS', // Russia
  GER: 'DEU', // Germany
  AUS: 'AUS', // Australia
  JPN: 'JPN', // Japan
  CAN: 'CAN', // Canada
  RSA: 'ZAF', // South Africa
  BEL: 'BEL', // Belgium
  ITA: 'ITA', // Italy
  CZE: 'CZE', // Czech Republic
  AUT: 'AUT', // Austria
  POL: 'POL', // Poland
  LAT: 'LVA', // Latvia
  UKR: 'UKR', // Ukraine
  SLO: 'SVK', // Slovakia (assuming SLO in data is Slovakia, needs verification if Slovenia)
  KAZ: 'KAZ', // Kazakhstan
  UZB: 'UZB', // Uzbekistan
  IND: 'IND', // India
  BUL: 'BGR', // Bulgaria
  ROU: 'ROU', // Romania
  LUX: 'LUX', // Luxembourg
  COL: 'COL', // Colombia
  BRA: 'BRA', // Brazil
  POR: 'PRT', // Portugal
  NED: 'NLD', // Netherlands
  FIN: 'FIN', // Finland
  SWE: 'SWE', // Sweden
  DEN: 'DNK', // Denmark
  NOR: 'NOR', // Norway
  GRE: 'GRC', // Greece
  TUR: 'TUR', // Turkey
  CHN: 'CHN', // China
  KOR: 'KOR', // South Korea
  THA: 'THA', // Thailand
  TPE: 'TWN', // Chinese Taipei (Taiwan)
  HKG: 'HKG', // Hong Kong
  DOM: 'DOM'  // Dominican Republic - Assuming, might need verification
  // Add more mappings as identified from the dataset
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
    .attr('width', mapWidth) // Use renamed variable
    .attr('height', mapHeight); // Use renamed variable

  path = d3.geoPath().projection(
    d3.geoNaturalEarth1().scale(160).translate([mapWidth / 2, mapHeight / 2]) // Use renamed variable
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
      const iso = d.id;
      const name = d.properties.name;
      showMapTooltip(event, iso, name); // Renamed for clarity
    })
    .on('mouseout', function() {
      d3.select(this).style('fill-opacity', 1);
      mapTooltip.transition().duration(200).style('opacity', 0); // Use renamed variable
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

function showMapTooltip(event, iso, name) { // Renamed for clarity
  const year = +d3.select('#year-slider').property('value');
  const wins = winsByCountryByYear[year] ? (winsByCountryByYear[year][iso] || 0) : 0;
  mapTooltip.transition().duration(200).style('opacity', 1); // Use renamed variable
  mapTooltip.html(`<strong>${name}</strong><br/>Cumulative Wins: ${wins}`)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY - 28) + 'px');
}

// --- Bracket Explorer Functions ---

function initBracketControls() {
  const yearSlider = d3.select('#bracket-year-slider');
  const genderSelect = d3.select('#bracket-gender-select');
  const yearDisplay = d3.select('#bracket-year-display');

  if (years.length > 0) {
    yearSlider
      .attr('min', years[0])
      .attr('max', years[years.length - 1])
      .attr('value', years[0]);
    yearDisplay.text(years[0]);
  }

  yearSlider.on('input', function() {
    const selectedYear = +this.value;
    const selectedGender = genderSelect.property('value');
    yearDisplay.text(selectedYear);
    renderBracket(selectedYear, selectedGender);
  });

  genderSelect.on('change', function() {
    const selectedYear = +yearSlider.property('value');
    const selectedGender = this.value;
    renderBracket(selectedYear, selectedGender);
  });
}

function initBracketDisplay() {
  bracketSvg = d3.select('#bracket-container')
    .append('svg')
      .attr('width', bracketWidth + bracketMargin.left + bracketMargin.right)
      .attr('height', bracketHeight + bracketMargin.top + bracketMargin.bottom)
    .append('g')
      .attr('transform', `translate(${bracketMargin.left},${bracketMargin.top})`);
}

function renderBracket(year, gender) {
  console.log(`Rendering bracket for Year: ${year}, Gender: ${gender}`);
  bracketSvg.selectAll('*').remove(); // Clear previous bracket
  nodeUniqueId = 0; // Reset unique ID counter for nodes

  // Update the bracket title
  const titleGender = gender === 'm' ? "Men's" : "Women's";
  d3.select('#bracket-title').text(`Road to the Title Bracket Explorer - ${year} ${titleGender} Singles`);

  const bracketData = buildBracketTreeData(year, gender);

  if (!bracketData || bracketData.length === 0) { // Adjusted condition: check if bracketData itself is empty or not an array with items
    bracketSvg.append('text')
      .attr('x', bracketWidth / 2)
      .attr('y', bracketHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .text('No data available for this selection.');
    return;
  }

  // Create a D3 hierarchy
  // The root of the hierarchy is now the first match (e.g., the Final)
  globalRoot = d3.hierarchy(bracketData[0], d => d.children); // Assuming bracketData is an array with the Final as the first element
  globalRoot.x0 = bracketHeight / 2; // Initial position for root
  globalRoot.y0 = 0;

  // Optional: Start with some nodes collapsed (e.g., beyond a certain depth)
  // globalRoot.descendants().forEach(d => {
  //   if (d.depth > 1 && d.children) { // Example: Collapse nodes deeper than depth 1
  //     d._children = d.children;
  //     d.children = null;
  //   }
  // });

  updateBracketTree(globalRoot, globalRoot); // Initial draw: source is root, rootHierarchy is root
}


function updateBracketTree(source, rootHierarchy) {
  const treeLayout = d3.tree().size([bracketHeight, bracketWidth]); // Use full bracketWidth for layout
  const treeData = treeLayout(rootHierarchy); // Apply layout to the (potentially modified) hierarchy

  const nodes = treeData.descendants();
  const links = treeData.links();

  // Normalize for fixed-depth. Higher value = more space between levels.
  nodes.forEach(d => {
    d.y = d.depth * 280;
    // d.x is managed by d3.tree layout
  });

  // -------- NODES --------
  const nodeSelection = bracketSvg.selectAll('g.node')
    .data(nodes, d => d.id || (d.id = ++nodeUniqueId)); // Use d.id from hierarchy or assign new

  // Enter new nodes at the source's previous position.
  const nodeEnter = nodeSelection.enter().append('g')
    .attr('class', 'node')
    .attr('transform', `translate(${source.y0},${source.x0})`)
    .on('click', function(event, d) { // d is the clicked hierarchy node
        highlightPlayerPath(d, rootHierarchy);

        // Toggle children if it's an internal node
        if (d.children || d._children) {
            if (d.children) { // If expanded, collapse it
                d._children = d.children;
                d.children = null;
            } else { // If collapsed (d._children exists), expand it
                d.children = d._children;
                d._children = null;
            }
            updateBracketTree(d, rootHierarchy); // Call update, clicked node 'd' is the source
        }
    })
    .on('mouseover', function(event, d) {
        showBracketTooltip(event, d.data);
        d3.select(this).select('circle').classed('hovered', true);
    })
    .on('mouseout', function(event, d) {
        hideBracketTooltip();
        d3.select(this).select('circle').classed('hovered', false);
    });

  // Append circle for the node
  nodeEnter.append('circle')
    .attr('r', 1e-6) // Start small for enter transition
    .style('stroke', '#333')
    .style('stroke-width', '1.5px');

  // Append text for the node
  nodeEnter.append('text')
    .attr('dy', '.35em')
    .attr('x', d => {
        if (!d.parent) { // This is the root node of the tree (Final match)
            return -12; // Position text to the left of the node for the root
        }
        return (d.children || d._children) ? -12 : 12; // Position based on internal/leaf for other nodes
    })
    .attr('text-anchor', d => {
        if (!d.parent) { // Root node
            return 'end'; // Anchor text to the end (right side of text aligns with x position)
        }
        return (d.children || d._children) ? 'end' : 'start'; // Anchor based on internal/leaf for others
    })
    .style('font-size', '9px')
    .text(d => {
        // All nodes are expected to be match nodes
        if (d.data && d.data.name && d.data.name.includes('vs')) {
            if (d.data.round === 'Final') { // The final match (root of the displayed tree)
                 return `${d.data.name} (Winner: ${d.data.winnerName})`;
            } else { // Other regular match nodes
                return `${d.data.name} (W: ${d.data.winnerName ? d.data.winnerName.split(' ').pop() : 'N/A'})`;
            }
        }
        return ''; // Fallback for unexpected node data structure, prevents odd labels
    });

  // Transition nodes to their new position.
  const nodeUpdate = nodeEnter.merge(nodeSelection);

  nodeUpdate.transition()
    .duration(transitionDuration)
    .attr('transform', d => `translate(${d.y},${d.x})`);

  nodeUpdate.select('circle')
    .attr('r', 6)
    .style('fill', d => d._children ? 'lightsteelblue' : (d.children ? '#555' : '#999')); // Collapsed, Internal (expanded), Leaf

  nodeUpdate.select('text')
    .style('fill-opacity', 1);

  // Transition exiting nodes to the source's new position (where children are collapsing to).
  const nodeExit = nodeSelection.exit().transition()
    .duration(transitionDuration)
    .attr('transform', `translate(${source.y},${source.x})`)
    .remove();

  nodeExit.select('circle').attr('r', 1e-6);
  nodeExit.select('text').style('fill-opacity', 1e-6);

  // -------- LINKS --------
  const linkSelection = bracketSvg.selectAll('path.link')
    .data(links, d => d.target.id); // Key links by target node's ID

  // Enter new links at the source's previous position.
  const linkEnter = linkSelection.enter().insert('path', 'g') // Insert links behind nodes (g)
    .attr('class', 'link')
    .attr('d', d => {
      const o = { x: source.x0, y: source.y0 }; // Start from source's old position
      return diagonal({ source: o, target: o });
    })
    .style('fill', 'none')
    .style('stroke', '#ccc')
    .style('stroke-width', '1.5px');

  // Transition links to their new position.
  const linkUpdate = linkEnter.merge(linkSelection);

  linkUpdate.transition()
    .duration(transitionDuration)
    .attr('d', d => diagonal(d)); // Use the diagonal helper

  // Transition exiting links to the source's new position.
  linkSelection.exit().transition()
    .duration(transitionDuration)
    .attr('d', d => {
      const o = { x: source.x, y: source.y }; // Exit to source's new position
      return diagonal({ source: o, target: o });
    })
    .remove();

  // Stash the new positions for later transitions.
  nodes.forEach(d => {
    d.x0 = d.x;
    d.y0 = d.y;
  });

  // Store the D3 hierarchy root for access by highlight function if needed elsewhere,
  // though it's passed as rootHierarchy.
  // bracketSvg.datum(rootHierarchy); // Not strictly necessary if rootHierarchy is managed well
}


function highlightPlayerPath(clickedHierarchyNode, rootHierarchy) {
    // clickedHierarchyNode.data contains player1, player2, winnerName, round, stats etc.
    if (!clickedHierarchyNode.data || !clickedHierarchyNode.data.winnerName || clickedHierarchyNode.data.round === undefined) {
        // Not a clickable match node (e.g., the root tournament title node) or winner is not defined.
        // Clear existing highlights if any, and do nothing else.
        bracketSvg.selectAll('.nodes g.highlighted').classed('highlighted', false);
        bracketSvg.selectAll('.links path.highlighted').classed('highlighted', false);
        return;
    }

    const playerName = clickedHierarchyNode.data.winnerName;
    if (!playerName) { // Should be caught by above, but as a safeguard
        bracketSvg.selectAll('.nodes g.highlighted').classed('highlighted', false);
        bracketSvg.selectAll('.links path.highlighted').classed('highlighted', false);
        return;
    }

    // Clear previous highlights
    bracketSvg.selectAll('.nodes g').classed('highlighted', false);
    bracketSvg.selectAll('.links path').classed('highlighted', false);

    // Identify all nodes (matches) the player participated in
    const nodesInPath = [];
    rootHierarchy.each(nodeDesc => { // Iterate over all nodes in the hierarchy
        if (nodeDesc.data && (nodeDesc.data.player1 === playerName || nodeDesc.data.player2 === playerName)) {
            nodesInPath.push(nodeDesc);
        }
    });

    // Apply 'highlighted' class to the DOM elements for these nodes
    bracketSvg.selectAll('.nodes g')
        .filter(d => nodesInPath.includes(d))
        .classed('highlighted', true);

    // Apply 'highlighted' class to the links connecting these nodes if the player won the 'target' match
    bracketSvg.selectAll('.links path')
        .filter(linkData => {
            const sourceNodeIsInPath = nodesInPath.includes(linkData.source);
            const targetNodeIsInPath = nodesInPath.includes(linkData.target);

            if (sourceNodeIsInPath && targetNodeIsInPath) {
                // linkData.target is the earlier round match (child in hierarchy)
                // linkData.source is the later round match (parent in hierarchy)
                // Highlight link if player won the target match to advance to source match
                return linkData.target.data.winnerName === playerName;
            }
            return false;
        })
        .classed('highlighted', true);
}


const roundOrder = [
  "First", "Second", "Third", "Fourth",
  "quarter", "semi", "Final"
];

// Helper to parse percentage strings like "65%" to a number 0.65
function parsePercentage(percString) {
    if (typeof percString === 'string' && percString.includes('%')) {
        return parseFloat(percString) / 100;
    }
    const num = parseFloat(percString);
    return isNaN(num) ? null : num; // Return null if not a valid number or percentage
}


function extractStats(match) {
    // Helper to get player-specific stats
    const getPlayerStats = (playerNum) => {
        return {
            firstServe: parsePercentage(match[`firstServe${playerNum}`]),
            aces: parseInt(match[`ace${playerNum}`]) || 0,
            doubleFaults: parseInt(match[`double${playerNum}`]) || 0,
            firstPointWon: parsePercentage(match[`firstPointWon${playerNum}`]),
            secPointWon: parsePercentage(match[`secPointWon${playerNum}`]) || 0,
            fastServe: parseInt(match[`fastServe${playerNum}`]) || null,
            avgFirstServe: parseInt(match[`avgFirstServe${playerNum}`]) || null,
            avgSecServe: parseInt(match[`avgSecServe${playerNum}`]) || null,
            breakPointsConverted: parsePercentage(match[`break${playerNum}`]), // e.g. 44%
            returnPointsWon: parsePercentage(match[`return${playerNum}`]), // e.g. 40%
            totalPointsWon: parseInt(match[`total${playerNum}`]) || 0,
            winners: parseInt(match[`winner${playerNum}`]) || 0, // Shot winners
            errors: parseInt(match[`error${playerNum}`]) || 0,
            netPointsWon: parsePercentage(match[`net${playerNum}`]) // e.g. 58%
        };
    };

    return {
        player1Stats: getPlayerStats(1),
        player2Stats: getPlayerStats(2),
        results: match.results // e.g., "7-5 3-6 7-6(3) 3-6 6-2"
    };
}


function buildBracketTreeData(year, gender) {
  const filteredMatches = tennisData.filter(d => +d.year === year && d.gender === gender);

  if (filteredMatches.length === 0) {
    return []; // Return an empty array if no matches
  }

  // Group matches by round
  const matchesByRound = {};
  roundOrder.forEach(r => matchesByRound[r] = []);

  filteredMatches.forEach(match => {
    if (matchesByRound[match.round]) {
      matchesByRound[match.round].push({
        name: `${match.player1} vs ${match.player2}`,
        player1: match.player1,
        player2: match.player2,
        winner: match.winner,
        round: match.round,
        stats: extractStats(match)
      });
    } else {
        // console.warn(`Unknown round type: ${match.round} for match: `, match);
    }
  });

  // Create a map of players to their last match node in the tree
  // This helps in linking winners of one round to their match in the next
  let playerNextMatch = {};

  // Build the tree structure from final backwards
  // The structure will be an array containing the final match node as the root(s)
  let finalMatchNodes = [];

  // The final match is the direct child of the root
  if (matchesByRound["Final"] && matchesByRound["Final"].length > 0) {
      matchesByRound["Final"].forEach(finalMatchData => {
          const finalNode = {
              name: `${finalMatchData.player1} vs ${finalMatchData.player2}`,
              player1: finalMatchData.player1, // Added player1
              player2: finalMatchData.player2, // Added player2
              winnerName: finalMatchData.winner,
              round: "Final",
              stats: finalMatchData.stats,
              children: [] // Final match has children representing players from semis
          };
          finalMatchNodes.push(finalNode);
          playerNextMatch[finalMatchData.player1] = finalNode;
          playerNextMatch[finalMatchData.player2] = finalNode;
      });
  } else {
      return []; // No final, no bracket
  }

  // Iterate backwards from semi-finals
  for (let i = roundOrder.indexOf("semi"); i >= 0; i--) {
      const currentRoundName = roundOrder[i];
      const nextRoundName = roundOrder[i+1]; // e.g. if current is semi, next is Final

      matchesByRound[currentRoundName].forEach(matchData => {
          // Find the match in the *next* round that this match's winner played in
          let parentNode = playerNextMatch[matchData.winner];

          if (parentNode) {
              const matchNode = {
                  name: `${matchData.player1} vs ${matchData.player2}`,
                  player1: matchData.player1, // Added player1
                  player2: matchData.player2, // Added player2
                  winnerName: matchData.winner,
                  round: currentRoundName,
                  stats: matchData.stats,
                  children: []
              };
              // Ensure children array exists
              if (!parentNode.children) {
                  parentNode.children = [];
              }
              parentNode.children.push(matchNode);
              // The players of *this* match will link to *this* matchNode from the previous round
              playerNextMatch[matchData.player1] = matchNode;
              playerNextMatch[matchData.player2] = matchNode;
          } else {
              // This can happen if a player who won this round isn't in the next round's data
              // (e.g. data inconsistency or walkover not captured leading to winner)
              // Or, if it's the earliest round and we don't build further back.
              // For now, we'll just log it if it's not the first round.
              if (i > 0) {
                // console.warn(`Could not find parent match for winner ${matchData.winner} from round ${currentRoundName} in round ${nextRoundName}`);
              }
          }
      });
  }
  return finalMatchNodes; // Return the array of final match nodes (should be just one for singles)
}

function showBracketTooltip(event, data) {
  bracketTooltip.transition().duration(200).style('opacity', .9);
  let content = `<strong>${data.name}</strong>`;

  if (data.winnerName) {
    content += `<br/>Winner: ${data.winnerName}`;
  }
  if (data.round) {
    content += `<br/>Round: ${data.round}`;
  }

  // Check if detailed match stats are available
  if (data.stats && data.stats.player1Stats && data.stats.player2Stats) {
    content += `<br/>Score: ${data.stats.results || 'N/A'}`;

    const p1Name = data.name.split(' vs ')[0];
    const p2Name = data.name.split(' vs ')[1];

    content += `<hr style="margin: 5px 0;">`;
    content += `<em>${p1Name}:</em>`;
    content += `<ul>`;
    content += `  <li>Aces: ${data.stats.player1Stats.aces !== undefined ? data.stats.player1Stats.aces : 'N/A'}</li>`;
    content += `  <li>DF: ${data.stats.player1Stats.doubleFaults !== undefined ? data.stats.player1Stats.doubleFaults : 'N/A'}</li>`;
    content += `  <li>Winners: ${data.stats.player1Stats.winners !== undefined ? data.stats.player1Stats.winners : 'N/A'}</li>`;
    content += `  <li>Errors: ${data.stats.player1Stats.errors !== undefined ? data.stats.player1Stats.errors : 'N/A'}</li>`;
    content += `  <li>1st Srv: ${data.stats.player1Stats.firstServe !== null ? (data.stats.player1Stats.firstServe * 100).toFixed(0) + '%' : 'N/A'}</li>`;
    content += `  <li>BP Conv: ${data.stats.player1Stats.breakPointsConverted !== null ? (data.stats.player1Stats.breakPointsConverted * 100).toFixed(0) + '%' : 'N/A'}</li>`;
    content += `</ul>`;

    content += `<em>${p2Name}:</em>`;
    content += `<ul>`;
    content += `  <li>Aces: ${data.stats.player2Stats.aces !== undefined ? data.stats.player2Stats.aces : 'N/A'}</li>`;
    content += `  <li>DF: ${data.stats.player2Stats.doubleFaults !== undefined ? data.stats.player2Stats.doubleFaults : 'N/A'}</li>`;
    content += `  <li>Winners: ${data.stats.player2Stats.winners !== undefined ? data.stats.player2Stats.winners : 'N/A'}</li>`;
    content += `  <li>Errors: ${data.stats.player2Stats.errors !== undefined ? data.stats.player2Stats.errors : 'N/A'}</li>`;
    content += `  <li>1st Srv: ${data.stats.player2Stats.firstServe !== null ? (data.stats.player2Stats.firstServe * 100).toFixed(0) + '%' : 'N/A'}</li>`;
    content += `  <li>BP Conv: ${data.stats.player2Stats.breakPointsConverted !== null ? (data.stats.player2Stats.breakPointsConverted * 100).toFixed(0) + '%' : 'N/A'}</li>`;
    content += `</ul>`;
  }

  bracketTooltip.html(content)
    .style('left', (event.pageX + 15) + 'px')
    .style('top', (event.pageY - 28) + 'px');
}

// Call this function to hide the tooltip
function hideBracketTooltip() {
    bracketTooltip.transition().duration(500).style('opacity', 0);
}

// --- BEGIN Radar Duel Functions ---

function extractAllPlayerNames(data) {
    const playerSet = new Set();
    data.forEach(d => {
        if (d.player1 && d.player1.trim() !== "") playerSet.add(d.player1.trim());
        if (d.player2 && d.player2.trim() !== "") playerSet.add(d.player2.trim());
    });
    return Array.from(playerSet).sort();
}

function initRadarDuelControls() {
    const playerADataList = d3.select('#playerA-datalist'); // Corrected based on HTML
    const playerBDataList = d3.select('#playerB-datalist'); // Corrected based on HTML

    allPlayerNames.forEach(name => {
        playerADataList.append('option').attr('value', name);
        playerBDataList.append('option').attr('value', name);
    });

    // Corrected IDs to match index.html
    d3.select('#playerA-select').on('input', updateRadarDuelVisualization);
    d3.select('#playerB-select').on('input', updateRadarDuelVisualization);
    d3.select('#radar-mirror-mode').on('change', updateRadarDuelVisualization);
    d3.select('#radar-baseline-switch').on('change', updateRadarDuelVisualization);

    // Setup SVGs for radar charts
    d3.select('#radar-playerA-container').append('svg')
        .attr('width', radarChartWidth)
        .attr('height', radarChartHeight)
        .append('g')
        .attr('class', 'radar-g')
        .attr('transform', `translate(${radarMargin.left},${radarMargin.top})`);

    d3.select('#radar-playerB-container').append('svg')
        .attr('width', radarChartWidth)
        .attr('height', radarChartHeight)
        .append('g')
        .attr('class', 'radar-g')
        .attr('transform', `translate(${radarMargin.left},${radarMargin.top})`);
}

function calculateAverageRadarStats(playerName, relevantMatches) {
    if (!playerName || relevantMatches.length === 0) {
        return radarChartStatsMeta.map(statMeta => ({
            axis: statMeta.axis,
            value: 0,
            original_value: 0 // Keep original_value for tooltips
        }));
    }

    const aggregatedStats = {};
    radarChartStatsMeta.forEach(statMeta => {
        aggregatedStats[statMeta.key] = [];
    });

    relevantMatches.forEach(match => {
        const playerSuffix = match.player1 === playerName ? '1' : (match.player2 === playerName ? '2' : null);
        if (!playerSuffix) return;

        radarChartStatsMeta.forEach(statMeta => {
            const rawStatValue = match[statMeta.key + playerSuffix];
            let parsedValue;
            if (statMeta.isPercentage) {
                parsedValue = parsePercentage(rawStatValue); // Already handles "N/A" or invalid by returning null
            } else {
                parsedValue = parseInt(rawStatValue);
            }
            // Ensure parsedValue is a valid number before pushing
            if (parsedValue !== null && !isNaN(parsedValue)) {
                aggregatedStats[statMeta.key].push(parsedValue);
            }
        });
    });

    const averagedStatsData = radarChartStatsMeta.map(statMeta => {
        const values = aggregatedStats[statMeta.key];
        let average = 0;
        if (values.length > 0) {
            average = values.reduce((sum, val) => sum + val, 0) / values.length;
        }
        // Value is the actual average. Scaling/Normalization happens during drawing.
        return { axis: statMeta.axis, value: average, original_value: average };
    });
    return averagedStatsData;
}

function updateRadarDuelVisualization() {
    // Corrected IDs to match index.html
    const playerAInputElement = document.getElementById('playerA-select');
    const playerBInputElement = document.getElementById('playerB-select');
    const mirrorModeCheckboxElement = document.getElementById('radar-mirror-mode');
    const h2hBaselineCheckboxElement = document.getElementById('radar-baseline-switch');

    let playerAName = "";
    let playerBName = "";
    let mirrorMode = false;
    let useH2HBaseline = false;

    if (playerAInputElement) {
        playerAName = playerAInputElement.value;
    } else {
        console.error("Radar Duel Error: HTML element with ID 'playerA-select' not found. Please check index.html.");
    }

    if (playerBInputElement) {
        playerBName = playerBInputElement.value;
    } else {
        console.error("Radar Duel Error: HTML element with ID 'playerB-select' not found. Please check index.html.");
    }

    if (mirrorModeCheckboxElement) {
        mirrorMode = mirrorModeCheckboxElement.checked;
    } else {
        console.error("Radar Duel Error: HTML element with ID 'radar-mirror-mode' not found. Please check index.html.");
    }

    if (h2hBaselineCheckboxElement) {
        useH2HBaseline = h2hBaselineCheckboxElement.checked;
    } else {
        console.error("Radar Duel Error: HTML element with ID 'radar-baseline-switch' not found. Please check index.html.");
    }

    // const playerAName = d3.select('#playerA-search').property('value'); // Original problematic line
    // const playerBName = d3.select('#playerB-search').property('value');
    // const mirrorMode = d3.select('#mirror-mode-checkbox').property('checked');
    // const useH2HBaseline = d3.select('#h2h-baseline-checkbox').property('checked');

    let matchesForA = playerAName ? tennisData.filter(m => m.player1 === playerAName || m.player2 === playerAName) : [];
    let matchesForB = playerBName ? tennisData.filter(m => m.player1 === playerBName || m.player2 === playerBName) : [];

    let h2hStatusMsgA = "";
    let h2hStatusMsgB = "";

    if (useH2HBaseline && playerAName && playerBName && playerAName !== playerBName) {
        const h2hMatches = tennisData.filter(m =>
            (m.player1 === playerAName && m.player2 === playerBName) ||
            (m.player1 === playerBName && m.player2 === playerAName)
        );
        if (h2hMatches.length > 0) {
            matchesForA = h2hMatches;
            matchesForB = h2hMatches;
        } else {
            matchesForA = []; // No H2H matches found
            matchesForB = [];
            h2hStatusMsgA = "No H2H data.";
            h2hStatusMsgB = "No H2H data.";
        }
    } else if (useH2HBaseline && playerAName && playerBName && playerAName === playerBName) {
        // Edge case: H2H with self doesn't make sense, use all matches.
        // Or display a message. For now, implicitly uses all matches as h2hMatches would be empty.
        h2hStatusMsgA = "H2H with self not applicable.";
        h2hStatusMsgB = "H2H with self not applicable.";
    }


    const statsA = playerAName ? calculateAverageRadarStats(playerAName, matchesForA) : getDefaultRadarData();
    const statsB = playerBName ? calculateAverageRadarStats(playerBName, matchesForB) : getDefaultRadarData();

    drawRadarChart('#radar-playerA-container', playerAName, statsA, playerBName ? statsB : null, mirrorMode, h2hStatusMsgA);
    drawRadarChart('#radar-playerB-container', playerBName, statsB, playerAName ? statsA : null, mirrorMode, h2hStatusMsgB);
}

function getDefaultRadarData() {
    return radarChartStatsMeta.map(statMeta => ({
        axis: statMeta.axis,
        value: 0,
        original_value: 0
    }));
}

function drawRadarChart(containerSelector, playerName, primaryPlayerData, secondaryPlayerData, mirrorMode, statusMessage) {
    const g = d3.select(containerSelector).select('svg').select('.radar-g');
    g.selectAll('*').remove(); // Clear previous chart elements

    const noDataForPlayer = primaryPlayerData.every(d => d.original_value === 0);

    if (!playerName || (noDataForPlayer && !statusMessage) ) {
        g.append('text')
            .attr('x', radarEffectiveWidth / 2)
            .attr('y', radarEffectiveHeight / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(playerName && noDataForPlayer ? 'No data for selection.' : 'Select a player.');
        return;
    }
     if (statusMessage) {
        g.append('text')
            .attr('x', radarEffectiveWidth / 2)
            .attr('y', radarEffectiveHeight / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(statusMessage);
        // If there's a status message (like "No H2H data"), we might not want to draw the chart,
        // or draw it greyed out. For now, it will show the message and an empty chart if noDataForPlayer is also true.
        if (noDataForPlayer && playerName) return; // Don't draw chart if no data and specific message shown
    }


    const levels = 5;
    const angleSlice = Math.PI * 2 / radarChartStatsMeta.length;

    const rScale = d3.scaleLinear()
        .range([0, Math.min(radarEffectiveWidth / 2, radarEffectiveHeight / 2)])
        .domain([0, 1]); // Domain is 0 to 1 because values will be normalized (value / statMeta.max)

    const gridWrapper = g.append('g')
      .attr('class', 'grid-wrapper')
      .attr('transform', `translate(${radarEffectiveWidth/2}, ${radarEffectiveHeight/2})`);

    gridWrapper.selectAll('.levels')
        .data(d3.range(1, levels + 1).reverse())
        .enter()
        .append('circle')
        .attr('class', 'grid-circle')
        .attr('r', d => d * rScale(1) / levels) // rScale(1) is max radius
        .style('fill', '#CDCDCD')
        .style('stroke', '#CDCDCD')
        .style('fill-opacity', 0.1);

    gridWrapper.selectAll(".axis-label-level")
       .data(d3.range(1, levels).reverse()) // Don't label the center 0%
       .enter().append("text")
       .attr("class", "axis-label-level")
       .attr("x", 4)
       .attr("y", d => -(d * rScale(1) / levels))
       .attr("dy", "0.4em")
       .style("font-size", "8px")
       .attr("fill", "#737373")
       .text(d => `${(100 * d / levels).toFixed(0)}%`);

    const axisGrid = g.append('g').attr('class', 'axis-wrapper')
        .attr('transform', `translate(${radarEffectiveWidth/2}, ${radarEffectiveHeight/2})`);

    const axes = axisGrid.selectAll('.axis')
        .data(radarChartStatsMeta)
        .enter()
        .append('g')
        .attr('class', 'axis');

    axes.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', (d, i) => rScale(1) * Math.cos(angleSlice * i - Math.PI / 2))
        .attr('y2', (d, i) => rScale(1) * Math.sin(angleSlice * i - Math.PI / 2))
        .attr('class', 'line')
        .style('stroke', 'white')
        .style('stroke-width', '1px');

    axes.append('text')
        .attr('class', 'legend')
        .style('font-size', '9px') // Slightly smaller
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('x', (d, i) => rScale(1 * 1.15) * Math.cos(angleSlice * i - Math.PI / 2)) // Adjusted for new margin
        .attr('y', (d, i) => rScale(1 * 1.15) * Math.sin(angleSlice * i - Math.PI / 2))
        .text(d => d.axis)
        .call(wrapText, radarMargin.left * 0.8); // Adjust wrap width based on margin

    const radarLine = d3.lineRadial()
        .angle((d, i) => i * angleSlice)
        .radius(d => {
            const meta = radarChartStatsMeta.find(m => m.axis === d.axis);
            if (!meta || meta.max === 0) return 0; // Avoid division by zero
            return rScale(Math.min(d.value / meta.max, 1)); // Ensure normalized value doesn't exceed 1
        })
        .curve(d3.curveLinearClosed);

    function plotPlayerData(data, className, color, baseOpacity, strokeWidth = "2px") {
        const plotData = data.map(stat => { // Ensure data is in correct order of radarChartStatsMeta
            const meta = radarChartStatsMeta.find(m => m.axis === stat.axis);
            return {...stat, statMeta: meta}; // Pass meta for normalization if needed, though done in radius
        });
         // Sort data to match radarChartStatsMeta order for consistent polygon shape
        const orderedPlotData = radarChartStatsMeta.map(meta => {
            return plotData.find(p => p.axis === meta.axis) || {axis: meta.axis, value: 0, original_value: 0, statMeta: meta};
        });


        const blobWrapper = g.selectAll('.' + className)
            .data([orderedPlotData]);

        blobWrapper.enter().append('path')
            .attr('class', className + ' radar-area')
            .attr('transform', `translate(${radarEffectiveWidth/2}, ${radarEffectiveHeight/2})`)
            .merge(blobWrapper)
            .attr('d', radarLine)
            .style('fill', color)
            .style('fill-opacity', baseOpacity)
            .style('stroke', color)
            .style('stroke-width', strokeWidth);

        blobWrapper.exit().remove();
        return g.select('.' + className); // Return the path selection
    }

    let primaryPath;
    if (playerName && !noDataForPlayer) {
       primaryPath = plotPlayerData(primaryPlayerData, 'primary-blob', 'steelblue', 0.35);
    }


    if (mirrorMode && secondaryPlayerData && secondaryPlayerData.some(d => d.original_value > 0)) {
        plotPlayerData(secondaryPlayerData, 'secondary-blob', 'rgba(200,0,0,0.6)', 0.20, "1.5px");

        if (primaryPath && primaryPath.node()) {
            let primaryIsStronger = false;
            for(let i=0; i < primaryPlayerData.length; i++) {
                const pMeta = radarChartStatsMeta.find(m => m.axis === primaryPlayerData[i].axis);
                const sMeta = radarChartStatsMeta.find(m => m.axis === secondaryPlayerData[i].axis);
                if (!pMeta || !sMeta) continue;

                const pValNormalized = pMeta.max > 0 ? primaryPlayerData[i].value / pMeta.max : 0;
                const sValNormalized = sMeta.max > 0 ? secondaryPlayerData[i].value / sMeta.max : 0;

                // For DFs, lower is better. For others, higher is better.
                if (primaryPlayerData[i].axis === "DFs") {
                    if (pValNormalized < sValNormalized) { primaryIsStronger = true; break; }
                } else {
                    if (pValNormalized > sValNormalized) { primaryIsStronger = true; break; }
                }
            }
            // primaryPath.classed('pulse-animation', primaryIsStronger); // Temporarily commented out for diagnosis
            console.log('Pulse animation class application temporarily disabled for diagnosis.');
        }
    } else {
        g.selectAll('.secondary-blob').remove();
        if (primaryPath) primaryPath.classed('pulse-animation', false);
    }

    g.append("text")
        .attr("x", radarEffectiveWidth / 2)
        .attr("y", -radarMargin.top / 2 - 5) // Adjusted y position
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text(playerName || "");

    if (playerName && !noDataForPlayer) {
        const tooltipGroup = g.append("g").attr("class", "radar-tooltip-values")
                              .attr('transform', `translate(${radarEffectiveWidth/2}, ${radarEffectiveHeight/2})`);

        const orderedPrimaryData = radarChartStatsMeta.map(meta => {
            return primaryPlayerData.find(p => p.axis === meta.axis) || {axis: meta.axis, value: 0, original_value: 0};
        });

        orderedPrimaryData.forEach((d, i) => {
            const meta = radarChartStatsMeta.find(m => m.axis === d.axis);
            if (!meta) return;
            const normalizedValue = meta.max > 0 ? Math.min(d.value / meta.max, 1) : 0;

            const x = rScale(normalizedValue * 1.05) * Math.cos(angleSlice * i - Math.PI / 2); // Slightly outside point
            const y = rScale(normalizedValue * 1.05) * Math.sin(angleSlice * i - Math.PI / 2);

            tooltipGroup.append("text")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", (angleSlice * i - Math.PI / 2 > 0 && angleSlice * i - Math.PI / 2 < Math.PI) ? "1em" : "-0.2em")
                .style("font-size", "9px")
                .attr("text-anchor", "middle")
                .text(meta.isPercentage ? (d.original_value * 100).toFixed(0) + "%" : d.original_value.toFixed(1));
        });
    }
}

function wrapText(text, width) {
  text.each(function() {
    var text = d3.select(this),
        words = text.text().split(/\\s+/).reverse(),
        word,
        line = [],
        lineNumber = 0,
        lineHeight = 1.1, // ems
        x = text.attr("x"), // Keep original x
        y = text.attr("y"), // Keep original y
        dy = parseFloat(text.attr("dy") || 0), // Ensure dy is a number
        tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");

    // Handle cases where text might be empty or just one word
    if (words.length === 1 && words[0] === "") return;
    if (words.length === 0 && text.text() !== "") words = [text.text()]; // If text was set before .call(wrapText)

    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width && line.length > 1) { // only wrap if more than one word in line
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
      }
    }
  });
}
// --- END Radar Duel Functions ---
