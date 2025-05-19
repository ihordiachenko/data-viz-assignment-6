# Australian Open Tennis Matches Visualization

This project visualizes 10 years of Australian Open tennis match data using D3.js. The visualization provides insights into match statistics, player performance, serve analysis, and country representation at the Australian Open over the past decade.

## Project Structure

- `index.html` - Main HTML file containing the structure of the webpage
- `styles.css` - CSS file for styling the visualization
- `script.js` - JavaScript file with D3.js code for creating dynamic visualizations
- `10yearAUSOpenMatches.csv` - Dataset containing 10 years of Australian Open tennis match data
- `world.geojson` - GeoJSON file for the world map

## Features

The project currently includes the following interactive visualizations:

1.  **Global Dominance Choropleth Map**:
    *   Visualizes cumulative match wins per country on a world map.
    *   Interactive year slider (2009-2018) to see how dominance shifts over time.
    *   Hover over a country to see its name and cumulative win count for the selected year.

2.  **Year-by-Year "Road to the Title" Bracket Explorer**:
    *   Reconstructs the tournament draw for a selected year and gender (Men/Women) as a collapsible tree.
    *   Displays match pairings, winners, and round information.
    *   Hover over a match node to view detailed statistics (aces, double faults, break points, etc.) for both players and the match score.
    *   Click on a player\'s name (winner of a match) in the bracket to highlight their entire path through the tournament.
    *   Filter by year and gender using dedicated controls.

3.  **Head-to-Head Radar Duel**:
    *   Compares two selected players based on their average match statistics over the decade.
    *   Stats include: 1st Serve %, Aces, Double Faults, Break Point Conversion %, and Net Points Won %.
    *   Autocomplete search boxes to easily find and select Player A and Player B.
    *   "Mirror Mode" checkbox: When enabled, overlays Player B\'s stats on Player A\'s chart and animates/pulses areas where one player has a distinct advantage.
    *   "Baseline: Only Head-to-Head Matches" checkbox: Switches the statistical baseline from all matches played by the selected players to only matches where they played against each other (if such matches exist in the dataset).

## How to Use

1. Open `index.html` in a web browser.
2. Use the filter controls to select specific years or gender categories.
3. Hover over chart elements to view detailed information.

## Data Description

The data includes information about matches, players, serve statistics, and match outcomes, including:

- Round information (Final, semi, quarter, etc.)
- Player names and countries
- Match results
- Serve statistics (first serve percentage, aces, etc.)
- Point statistics (winners, errors, etc.)

## Technologies Used

- HTML5
- CSS3
- JavaScript
- D3.js (Version 7)

