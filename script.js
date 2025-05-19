// Main Script for Australian Open Tennis Matches Visualization

// Data will be loaded and stored here
let tennisData = [];

// Initialize visualization after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load the CSV data
    loadData();
});

// Function to load the CSV data
function loadData() {
    d3.csv('10yearAUSOpenMatches.csv')
        .then(data => {
            // Process the data
            tennisData = data.map(d => {
                // Convert strings to numbers as needed
                return {
                    ...d,
                    year: +d.year,
                    firstServe1: parseFloat(d.firstServe1.endsWith('%') ? d.firstServe1.replace('%', '') : d.firstServe1) / 100,
                    firstServe2: parseFloat(d.firstServe2.endsWith('%') ? d.firstServe2.replace('%', '') : d.firstServe2) / 100,
                    ace1: +d.ace1,
                    ace2: +d.ace2,
                    double1: +d.double1,
                    double2: +d.double2,
                    firstPointWon1: parseFloat(d.firstPointWon1.endsWith('%') ? d.firstPointWon1.replace('%', '') : d.firstPointWon1) / 100,
                    firstPointWon2: parseFloat(d.firstPointWon2.endsWith('%') ? d.firstPointWon2.replace('%', '') : d.firstPointWon2) / 100,
                    secPointWon1: parseFloat(d.secPointWon1.endsWith('%') ? d.secPointWon1.replace('%', '') : d.secPointWon1) / 100,
                    secPointWon2: parseFloat(d.secPointWon2.endsWith('%') ? d.secPointWon2.replace('%', '') : d.secPointWon2) / 100,
                    fastServe1: +d.fastServe1,
                    fastServe2: +d.fastServe2,
                    avgFirstServe1: +d.avgFirstServe1,
                    avgFirstServe2: +d.avgFirstServe2,
                    avgSecServe1: +d.avgSecServe1,
                    avgSecServe2: +d.avgSecServe2,
                    break1: d.break1 === '-' ? null : parseFloat(d.break1.endsWith('%') ? d.break1.replace('%', '') : d.break1) / 100,
                    break2: d.break2 === '-' ? null : parseFloat(d.break2.endsWith('%') ? d.break2.replace('%', '') : d.break2) / 100,
                    return1: d.return1 === '-' ? null : parseFloat(d.return1.endsWith('%') ? d.return1.replace('%', '') : d.return1) / 100,
                    return2: d.return2 === '-' ? null : parseFloat(d.return2.endsWith('%') ? d.return2.replace('%', '') : d.return2) / 100,
                    total1: +d.total1,
                    total2: +d.total2,
                    winner1: +d.winner1,
                    winner2: +d.winner2,
                    error1: +d.error1,
                    error2: +d.error2
                };
            });

            console.log('Data loaded:', tennisData.slice(0, 5)); // Log first few rows

            // Populate year filter options
            populateYearFilter();

            // Initialize visualizations
            initMatchStatsChart();
            initPlayerPerformanceChart();
            initServeAnalysisChart();
            initCountryChart();

            // Set up event listeners for filters
            setupEventListeners();
        })
        .catch(error => {
            console.error('Error loading data:', error);
        });
}

// Function to populate the year filter dropdown
function populateYearFilter() {
    const years = [...new Set(tennisData.map(d => d.year))].sort();
    const yearSelect = document.getElementById('year-filter');

    console.log('Populating year filter with years:', years);

    if (!yearSelect) {
        console.error('Year filter select element not found');
        return;
    }

    // Clear any existing options except the "All Years" option
    while (yearSelect.options.length > 1) {
        yearSelect.remove(1);
    }

    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    console.log('Year filter now has', yearSelect.options.length, 'options');
}

// Function to set up event listeners for filters
function setupEventListeners() {
    console.log('Setting up event listeners for filters');

    const yearFilter = document.getElementById('year-filter');
    const genderFilter = document.getElementById('gender-filter');

    if (!yearFilter) {
        console.error('Year filter element not found');
    } else {
        yearFilter.addEventListener('change', function() {
            console.log('Year filter changed to:', this.value);
            updateVisualizations();
        });
    }

    if (!genderFilter) {
        console.error('Gender filter element not found');
    } else {
        genderFilter.addEventListener('change', function() {
            console.log('Gender filter changed to:', this.value);
            updateVisualizations();
        });
    }
}

// Function to filter data based on selected options
function filterData() {
    const yearFilter = document.getElementById('year-filter').value;
    const genderFilter = document.getElementById('gender-filter').value;

    console.log('Filtering data with:', { yearFilter, genderFilter });

    const filteredData = tennisData.filter(d => {
        const yearMatch = yearFilter === 'all' || +d.year === +yearFilter;
        const genderMatch = genderFilter === 'all' || d.gender === genderFilter;
        return yearMatch && genderMatch;
    });

    console.log('Filtered data count:', filteredData.length);
    return filteredData;
}

// Function to display a "no data" message in a chart container
function showNoDataMessage(selector, width, height) {
    const svg = d3.select(selector)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('fill', '#666')
        .text('No data available for this selection');
}

// Function to update all visualizations
function updateVisualizations() {
    const filteredData = filterData();

    updateMatchStatsChart(filteredData);
    updatePlayerPerformanceChart(filteredData);
    updateServeAnalysisChart(filteredData);
    updateCountryChart(filteredData);
}

// Function to initialize the match stats chart
function initMatchStatsChart() {
    const filteredData = filterData();
    updateMatchStatsChart(filteredData);
}

// Function to update the match stats chart
function updateMatchStatsChart(data) {
    // Clear previous chart
    d3.select('#match-stats-chart').html('');

    const width = document.getElementById('match-stats-chart').clientWidth;
    const height = 400;
    const margin = { top: 40, right: 30, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Check if data is empty
    if (data.length === 0) {
        showNoDataMessage('#match-stats-chart', width, height);
        return;
    }

    // Group data by round
    const roundCounts = d3.rollup(
        data,
        v => v.length,
        d => d.round
    );

    // Convert Map to array for D3
    const roundData = Array.from(roundCounts, ([round, count]) => ({ round, count }));

    // Sort rounds in a meaningful order
    const roundOrder = ['First', 'Second', 'Third', 'Fourth', 'quarter', 'semi', 'Final'];
    roundData.sort((a, b) => roundOrder.indexOf(a.round) - roundOrder.indexOf(b.round));

    // Create SVG
    const svg = d3.select('#match-stats-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create scales
    const xScale = d3.scaleBand()
        .domain(roundData.map(d => d.round))
        .range([0, innerWidth])
        .padding(0.2);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(roundData, d => d.count) * 1.1])
        .range([innerHeight, 0]);

    // Create axes
    g.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    g.append('g')
        .call(d3.axisLeft(yScale));

    // Create bars
    g.selectAll('.bar')
        .data(roundData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.round))
        .attr('y', d => yScale(d.count))
        .attr('width', xScale.bandwidth())
        .attr('height', d => innerHeight - yScale(d.count))
        .attr('fill', '#3498db')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('fill', '#2980b9');

            // Show tooltip
            const tooltip = d3.select('body').append('div')
                .attr('class', 'tooltip')
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .style('opacity', 0);

            tooltip.html(`<strong>${d.round}:</strong> ${d.count} matches`)
                .style('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this).attr('fill', '#3498db');
            d3.select('.tooltip').remove();
        });

    // Add chart title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Match Count by Round');

    // Add axis labels
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height - 5)
        .attr('text-anchor', 'middle')
        .text('Round');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .text('Number of Matches');
}

// Function to initialize the player performance chart
function initPlayerPerformanceChart() {
    const filteredData = filterData();
    updatePlayerPerformanceChart(filteredData);
}

// Function to update the player performance chart
function updatePlayerPerformanceChart(data) {
    // Clear previous chart
    d3.select('#player-performance-chart').html('');

    const width = document.getElementById('player-performance-chart').clientWidth;
    const height = 400;

    // Check if data is empty
    if (data.length === 0) {
        showNoDataMessage('#player-performance-chart', width, height);
        return;
    }

    // Find top 10 players by win count
    const playerWins = {};
    data.forEach(d => {
        const winner = d.winner;
        if (!playerWins[winner]) {
            playerWins[winner] = 0;
        }
        playerWins[winner]++;
    });

    const topPlayers = Object.entries(playerWins)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([player, wins]) => ({ player, wins }));

    const width = document.getElementById('player-performance-chart').clientWidth;
    const height = 400;
    const margin = { top: 40, right: 30, bottom: 60, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select('#player-performance-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create scales
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(topPlayers, d => d.wins) * 1.1])
        .range([0, innerWidth]);

    const yScale = d3.scaleBand()
        .domain(topPlayers.map(d => d.player))
        .range([0, innerHeight])
        .padding(0.2);

    // Create axes
    g.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale));

    g.append('g')
        .call(d3.axisLeft(yScale));

    // Create bars
    g.selectAll('.bar')
        .data(topPlayers)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', d => yScale(d.player))
        .attr('width', d => xScale(d.wins))
        .attr('height', yScale.bandwidth())
        .attr('fill', '#2ecc71')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('fill', '#27ae60');

            // Show tooltip
            const tooltip = d3.select('body').append('div')
                .attr('class', 'tooltip')
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .style('opacity', 0);

            tooltip.html(`<strong>${d.player}:</strong> ${d.wins} wins`)
                .style('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this).attr('fill', '#2ecc71');
            d3.select('.tooltip').remove();
        });

    // Add chart title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Top 10 Players by Wins');

    // Add axis labels
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height - 5)
        .attr('text-anchor', 'middle')
        .text('Number of Wins');
}

// Function to initialize the serve analysis chart
function initServeAnalysisChart() {
    const filteredData = filterData();
    updateServeAnalysisChart(filteredData);
}

// Function to update the serve analysis chart
function updateServeAnalysisChart(data) {
    // Clear previous chart
    d3.select('#serve-analysis-chart').html('');

    const width = document.getElementById('serve-analysis-chart').clientWidth;
    const height = 400;
    const margin = { top: 40, right: 120, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Check if data is empty
    if (data.length === 0) {
        showNoDataMessage('#serve-analysis-chart', width, height);
        return;
    }

    // Calculate average serve stats
    const serveStats = [
        { category: 'First Serve %',
          winner: d3.mean(data, d => d.winner === d.player1 ? d.firstServe1 : d.firstServe2),
          loser: d3.mean(data, d => d.winner !== d.player1 ? d.firstServe1 : d.firstServe2) },
        { category: 'First Serve Points Won %',
          winner: d3.mean(data, d => d.winner === d.player1 ? d.firstPointWon1 : d.firstPointWon2),
          loser: d3.mean(data, d => d.winner !== d.player1 ? d.firstPointWon1 : d.firstPointWon2) },
        { category: 'Second Serve Points Won %',
          winner: d3.mean(data, d => d.winner === d.player1 ? d.secPointWon1 : d.secPointWon2),
          loser: d3.mean(data, d => d.winner !== d.player1 ? d.secPointWon1 : d.secPointWon2) },
        { category: 'Aces',
          winner: d3.mean(data, d => d.winner === d.player1 ? d.ace1 : d.ace2),
          loser: d3.mean(data, d => d.winner !== d.player1 ? d.ace1 : d.ace2) },
        { category: 'Double Faults',
          winner: d3.mean(data, d => d.winner === d.player1 ? d.double1 : d.double2),
          loser: d3.mean(data, d => d.winner !== d.player1 ? d.double1 : d.double2) }
    ];

    // Create SVG
    const svg = d3.select('#serve-analysis-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create scales
    const xScale = d3.scaleBand()
        .domain(serveStats.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(serveStats, d => Math.max(d.winner, d.loser)) * 1.1])
        .range([innerHeight, 0]);

    // Create grouped bar chart
    const subgroups = ['winner', 'loser'];
    const xSubgroup = d3.scaleBand()
        .domain(subgroups)
        .range([0, xScale.bandwidth()])
        .padding(0.05);

    const color = d3.scaleOrdinal()
        .domain(subgroups)
        .range(['#3498db', '#e74c3c']);

    // Create grouped bars
    g.selectAll('.bar-group')
        .data(serveStats)
        .enter()
        .append('g')
        .attr('transform', d => `translate(${xScale(d.category)}, 0)`)
        .selectAll('rect')
        .data(d => subgroups.map(key => ({ key, value: d[key] })))
        .enter()
        .append('rect')
        .attr('x', d => xSubgroup(d.key))
        .attr('y', d => yScale(d.value))
        .attr('width', xSubgroup.bandwidth())
        .attr('height', d => innerHeight - yScale(d.value))
        .attr('fill', d => color(d.key))
        .on('mouseover', function(event, d) {
            // Show tooltip
            const tooltip = d3.select('body').append('div')
                .attr('class', 'tooltip')
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .style('opacity', 0);

            const formattedValue = d.key === 'double' || d.key === 'ace' ?
                d.value.toFixed(1) : (d.value * 100).toFixed(1) + '%';

            tooltip.html(`<strong>${d.key === 'winner' ? 'Match Winners' : 'Match Losers'}:</strong> ${formattedValue}`)
                .style('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select('.tooltip').remove();
        });

    // Create axes
    g.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    g.append('g')
        .call(d3.axisLeft(yScale)
            .tickFormat(d => {
                // Check if the first three categories which represent percentages
                const isPercentageCategory = ['First Serve %', 'First Serve Points Won %', 'Second Serve Points Won %'];
                return isPercentageCategory.some(cat => serveStats.find(s => s.category === cat)) ?
                    (d * 100).toFixed(0) + '%' : d.toFixed(1);
            }));

    // Add chart title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Serve Statistics Comparison: Winners vs. Losers');

    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width - margin.right + 20}, ${margin.top})`);

    legend.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', color('winner'));

    legend.append('text')
        .attr('x', 20)
        .attr('y', 12.5)
        .text('Winners')
        .style('font-size', '12px');

    legend.append('rect')
        .attr('x', 0)
        .attr('y', 25)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', color('loser'));

    legend.append('text')
        .attr('x', 20)
        .attr('y', 37.5)
        .text('Losers')
        .style('font-size', '12px');
}

// Function to initialize the country chart
function initCountryChart() {
    const filteredData = filterData();
    updateCountryChart(filteredData);
}

// Function to update the country chart
function updateCountryChart(data) {
    // Clear previous chart
    d3.select('#country-chart').html('');

    const width = document.getElementById('country-chart').clientWidth;
    const height = 400;
    const margin = { top: 40, right: 30, bottom: 100, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Check if data is empty
    if (data.length === 0) {
        showNoDataMessage('#country-chart', width, height);
        return;
    }

    // Count winners by country
    const countryWins = {};
    data.forEach(d => {
        const winnerCountry = d.winner === d.player1 ? d.country1 : d.country2;
        if (!countryWins[winnerCountry]) {
            countryWins[winnerCountry] = 0;
        }
        countryWins[winnerCountry]++;
    });

    // Convert to array and sort
    const countryData = Object.entries(countryWins)
        .map(([country, wins]) => ({ country, wins }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 10); // Top 10 countries

    // Create SVG
    const svg = d3.select('#country-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create scales
    const xScale = d3.scaleBand()
        .domain(countryData.map(d => d.country))
        .range([0, innerWidth])
        .padding(0.2);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(countryData, d => d.wins) * 1.1])
        .range([innerHeight, 0]);

    // Create bars
    g.selectAll('.bar')
        .data(countryData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.country))
        .attr('y', d => yScale(d.wins))
        .attr('width', xScale.bandwidth())
        .attr('height', d => innerHeight - yScale(d.wins))
        .attr('fill', '#9b59b6')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('fill', '#8e44ad');

            // Show tooltip
            const tooltip = d3.select('body').append('div')
                .attr('class', 'tooltip')
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .style('opacity', 0);

            tooltip.html(`<strong>${d.country}:</strong> ${d.wins} wins`)
                .style('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this).attr('fill', '#9b59b6');
            d3.select('.tooltip').remove();
        });

    // Create axes
    g.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    g.append('g')
        .call(d3.axisLeft(yScale));

    // Add chart title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Top 10 Countries by Wins');

    // Add axis labels
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height - 5)
        .attr('text-anchor', 'middle')
        .text('Country');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .text('Number of Wins');
}
