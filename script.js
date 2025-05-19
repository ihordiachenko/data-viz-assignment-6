// Global Dominance Choropleth with Time-Slider
// Uses D3.js v7 and TopoJSON for world map

// Store match data and aggregated wins per country by year
let tennisData = [];
let winsByCountryByYear = {};
let years = [];

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
