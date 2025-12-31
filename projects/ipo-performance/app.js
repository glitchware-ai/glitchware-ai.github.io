const margin = { top: 60, right: 60, bottom: 60, left: 140 };
const rowHeight = 32;

let appData = [];
let currentSort = "date-desc";
let currentMetric = "ytd"; // "ytd" or "listing"
let svg, g, xScale, yScale, xAxisBottom, xAxisTop, grid;

async function init() {
    try {
        const rawData = await d3.csv("data.csv");

        appData = rawData
            .filter(d => {
                const issue = parseFloat(d["ISSUE PRICE"]);
                const cmp = parseFloat(d["CMP"]);
                const ath = parseFloat(d["ATH"]);
                const listing = parseFloat(d["LISTING PRICE"]);
                return !isNaN(issue) && d.Symbol !== "";
            })
            .map(d => {
                const issue = parseFloat(d["ISSUE PRICE"]);
                const cmp = parseFloat(d["CMP"]);
                const ath = parseFloat(d["ATH"]);
                const listing = parseFloat(d["LISTING PRICE"]);

                // Sanitizing #N/A and NaN values
                const safeCmp = isNaN(cmp) ? issue : cmp;
                const safeAth = isNaN(ath) ? issue : ath;
                const safeListing = isNaN(listing) ? issue : listing;

                return {
                    symbol: d.Symbol,
                    date: d["DATE OF LISTING"],
                    issue: issue,
                    cmp: safeCmp,
                    ath: safeAth,
                    listing: safeListing,
                    ytdGain: ((safeCmp - issue) / issue) * 100,
                    listingGain: ((safeListing - issue) / issue) * 100,
                    athGain: ((safeAth - issue) / issue) * 100
                };
            });

        updateStats();

        // Setup Sort Listener
        d3.select("#sort-select").on("change", function () {
            currentSort = this.value;
            sortAndRender();
        });

        // Setup Metric Listeners
        d3.selectAll(".selector-btn").on("click", function () {
            const metric = d3.select(this).attr("data-metric");
            if (metric === currentMetric) return;

            currentMetric = metric;

            // UI Update: Sync all button sets
            d3.selectAll(".selector-btn").classed("active", false);
            d3.selectAll(`.selector-btn[data-metric="${metric}"]`).classed("active", true);

            // Re-render everything
            updateStats();
            setupChart();
            renderTimeline();
            sortAndRender();
        });

        setupChart();
        renderTimeline();
        sortAndRender();
    } catch (error) {
        console.error("Error loading or processing data:", error);
    }
}

function updateStats() {
    const gainKey = currentMetric === "ytd" ? "ytdGain" : "listingGain";

    const topGainer = appData.reduce((prev, current) => (prev[gainKey] > current[gainKey]) ? prev : current);
    const topLoser = appData.reduce((prev, current) => (prev[gainKey] < current[gainKey]) ? prev : current);

    const positiveCount = appData.filter(d => d[gainKey] > 0).length;
    const negativeCount = appData.filter(d => d[gainKey] < 0).length;
    const flatCount = appData.filter(d => d[gainKey] === 0).length;

    d3.select("#stat-total").text(appData.length);
    d3.select("#stat-positive").text(positiveCount);
    d3.select("#stat-negative").text(negativeCount);
    d3.select("#stat-flat").text(flatCount);
    d3.select("#stat-top-gainer").text(`${topGainer.symbol} (${topGainer[gainKey].toFixed(1)}%)`);
    d3.select("#stat-top-loser").text(`${topLoser.symbol} (${topLoser[gainKey].toFixed(1)}%)`);

    // Update header subtitle
    const label = currentMetric === "ytd" ? "Listing-to-EoY gains" : "Listing gains";
    d3.select(".subtitle").text(`Visualizing ${label} of 2025 IPOs. Last updated: 31 Dec 2025`);
}

function setupChart() {
    const chartContainer = d3.select("#chart");
    chartContainer.selectAll("*").remove();

    const containerWidth = chartContainer.node().getBoundingClientRect().width;
    const width = containerWidth - margin.left - margin.right;
    const height = (appData.length * rowHeight);

    svg = chartContainer
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const gainKey = currentMetric === "ytd" ? "ytdGain" : "listingGain";
    const minGain = d3.min(appData, d => Math.min(d[gainKey], 0, d.athGain)) - 5;
    const maxGain = d3.max(appData, d => Math.max(d[gainKey], 0, d.athGain)) + 5;

    xScale = d3.scaleLinear()
        .domain([minGain, maxGain])
        .range([0, width]);

    yScale = d3.scaleBand()
        .domain(appData.map(d => d.symbol))
        .range([0, height])
        .padding(0.25);

    // Grid lines
    grid = g.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`);

    // Axes containers
    xAxisBottom = g.append("g")
        .attr("class", "x-axis-bottom")
        .attr("transform", `translate(0,${height})`);

    xAxisTop = g.append("g")
        .attr("class", "x-axis-top");

    // Static labels
    g.append("text")
        .attr("x", width / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .attr("class", "axis-label")
        .text("Percentage Gain/Loss from Issue Price");

    g.append("line")
        .attr("class", "center-line")
        .attr("x1", xScale(0))
        .attr("y1", 0)
        .attr("x2", xScale(0))
        .attr("y2", height);

    updateStaticAxes(width, height);
}

function renderTimeline() {
    const timeline = d3.select("#timeline-chart");
    timeline.selectAll("*").remove();

    const parseDate = d3.timeParse("%d-%b-%y");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const groupedData = months.map(m => ({
        month: m,
        ipos: appData.filter(d => {
            const date = parseDate(d.date);
            return date && date.toLocaleString('default', { month: 'short' }) === m;
        }).sort((a, b) => parseDate(a.date) - parseDate(b.date))
    }));

    const totalIPOs = appData.length;
    const minMonthWidth = 2; // Fixed small width for empty months

    const segments = timeline.selectAll(".month-segment")
        .data(groupedData)
        .enter()
        .append("div")
        .attr("class", "month-segment")
        .style("width", d => {
            if (d.ipos.length === 0) return `${minMonthWidth}%`;
            // Calculate proportional width for non-empty months
            const availableWidth = 100 - (groupedData.filter(m => m.ipos.length === 0).length * minMonthWidth);
            const share = (d.ipos.length / totalIPOs) * availableWidth;
            return `${share}%`;
        });

    segments.append("span")
        .attr("class", "month-label")
        .text(d => d.month);

    segments.each(function (d) {
        if (d.ipos.length === 0) return;

        const gainKey = currentMetric === "ytd" ? "ytdGain" : "listingGain";
        const segment = d3.select(this);
        segment.selectAll(".ipo-bar")
            .data(d.ipos)
            .enter()
            .append("div")
            .attr("class", d => `ipo-bar ${d[gainKey] >= 0 ? 'gain' : 'loss'}`)
            .on("mouseover", showTooltip)
            .on("mouseout", hideTooltip)
            .on("mousemove", (event) => updateTooltipPosition(event));
    });
}

function updateStaticAxes(width, height) {
    grid.call(d3.axisBottom(xScale).ticks(10).tickSize(-height).tickFormat(""));
    xAxisBottom.call(d3.axisBottom(xScale).ticks(10).tickFormat(d => d + "%"))
        .selectAll("text").attr("class", "axis-label");
    xAxisTop.call(d3.axisTop(xScale).ticks(10).tickFormat(d => d + "%"))
        .selectAll("text").attr("class", "axis-label");
}

function sortAndRender() {
    const parseDate = d3.timeParse("%d-%b-%y");

    const gainKey = currentMetric === "ytd" ? "ytdGain" : "listingGain";

    if (currentSort === "date-desc") {
        appData.sort((a, b) => parseDate(b.date) - parseDate(a.date));
    } else if (currentSort === "date-asc") {
        appData.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    } else if (currentSort === "gain-desc") {
        appData.sort((a, b) => b[gainKey] - a[gainKey]);
    } else if (currentSort === "gain-asc") {
        appData.sort((a, b) => a[gainKey] - b[gainKey]);
    }

    // Explicitly update domain for yScale to match new order
    yScale.domain(appData.map(d => d.symbol));

    renderRows();
}

function renderRows() {
    const t = d3.transition().duration(800).ease(d3.easeCubicInOut);

    // Bind data with symbol as key for smooth transitions
    const rows = g.selectAll(".ipo-row")
        .data(appData, d => d.symbol);

    // EXIT
    rows.exit().transition(t).style("opacity", 0).remove();

    // ENTER
    const rowsEnter = rows.enter()
        .append("g")
        .attr("class", "ipo-row")
        .attr("transform", d => `translate(0, ${yScale(d.symbol)})`)
        .style("opacity", 0);

    // Create Row Elements (only once on enter)
    rowsEnter.append("line").attr("class", "wick");
    rowsEnter.append("rect").attr("class", "candle-body")
        .attr("rx", 4)
        .on("mouseover", showTooltip)
        .on("mouseout", hideTooltip)
        .on("mousemove", (event) => updateTooltipPosition(event));

    rowsEnter.append("text").attr("class", "symbol-label-left").attr("x", -120);
    rowsEnter.append("text").attr("class", "issue-label")
        .attr("x", xScale(0))
        .attr("text-anchor", "middle");

    // UPDATE + ENTER
    const rowsUpdate = rowsEnter.merge(rows);
    const gainKey = currentMetric === "ytd" ? "ytdGain" : "listingGain";

    rowsUpdate.transition(t)
        .attr("transform", d => `translate(0, ${yScale(d.symbol)})`)
        .style("opacity", 1);

    // Update sub-elements within the transitioned group
    rowsUpdate.select(".wick")
        .attr("x1", xScale(0))
        .attr("y1", yScale.bandwidth() / 2)
        .attr("x2", d => xScale(d.athGain))
        .attr("y2", yScale.bandwidth() / 2)
        .attr("stroke", d => d[gainKey] >= 0 ? "var(--gain-color)" : "var(--loss-color)")
        .attr("stroke-opacity", 0.4);

    rowsUpdate.select(".candle-body")
        .attr("x", d => Math.min(xScale(0), xScale(d[gainKey])))
        .attr("y", 0)
        .attr("width", d => Math.abs(xScale(d[gainKey]) - xScale(0)))
        .attr("height", yScale.bandwidth())
        .attr("fill", d => d[gainKey] >= 0 ? "var(--gain-color)" : "var(--loss-color)");

    rowsUpdate.select(".symbol-label-left")
        .attr("y", yScale.bandwidth() / 2 + 5)
        .text(d => d.symbol);

    rowsUpdate.select(".issue-label")
        .attr("y", yScale.bandwidth() / 2 + 5)
        .text(d => `₹${d.issue}`);
}

// Tooltip logic
const tooltip = d3.select("#tooltip");

function showTooltip(event, d) {
    tooltip.classed("hidden", false).style("opacity", 1);
    const gainKey = currentMetric === "ytd" ? "ytdGain" : "listingGain";
    const currentGain = d[gainKey];

    d3.select("#tt-symbol").text(d.symbol);
    d3.select("#tt-date").text(d.date);
    d3.select("#tt-issue").text(d.issue.toFixed(2));

    // Update tooltip rows based on metric
    if (currentMetric === "ytd") {
        d3.select("#tt-cmp-label").text("CMP");
        d3.select("#tt-cmp").text(d.cmp.toFixed(2));
    } else {
        d3.select("#tt-cmp-label").text("Listing Price");
        d3.select("#tt-cmp").text(d.listing.toFixed(2));
    }

    d3.select("#tt-gain").text(currentGain.toFixed(2) + "%")
        .style("color", currentGain >= 0 ? "var(--gain-color)" : "var(--loss-color)");

    d3.select("#tt-ath").text(d.ath.toFixed(2));
    d3.select("#tt-ath-gain").text(d.athGain.toFixed(1) + "%");
    updateTooltipPosition(event);
}

function updateTooltipPosition(event) {
    const tooltipNode = tooltip.node();
    if (!tooltipNode) return;
    const tooltipWidth = tooltipNode.offsetWidth;
    const tooltipHeight = tooltipNode.offsetHeight;
    let xPos = event.pageX + 15;
    let yPos = event.pageY + 15;
    if (xPos + tooltipWidth > window.innerWidth + window.scrollX - 20) xPos = event.pageX - tooltipWidth - 15;
    if (yPos + tooltipHeight > window.innerHeight + window.scrollY - 20) yPos = event.pageY - tooltipHeight - 15;
    tooltip.style("left", xPos + "px").style("top", yPos + "px");
}

function hideTooltip() {
    tooltip.classed("hidden", true).style("opacity", 0);
}

window.addEventListener("resize", () => {
    setupChart();
    renderTimeline();
    renderRows();
});

// Helper for Downloading
function downloadDashboard() {
    const btn = document.getElementById("download-btn");
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    // Target the entire app container
    const element = document.querySelector(".app-container");

    // Hide tooltips before capturing
    hideTooltip();

    // Small delay to ensure any layout shifts or class changes are settled
    setTimeout(() => {
        html2canvas(element, {
            scale: 2, // 2x resolution for retina-ready quality
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#f8fafc", // Explicitly set background color matching CSS
            logging: false,
            onclone: (clonedDoc) => {
                // Remove the download button itself from the image
                const clonedBtn = clonedDoc.getElementById("download-btn");
                if (clonedBtn) clonedBtn.style.display = "none";

                // Ensure everything is visible in the clone
                const clonedContent = clonedDoc.querySelector(".app-container");
                if (clonedContent) {
                    clonedContent.style.padding = "40px";
                    clonedContent.style.width = "1200px";
                }
            }
        }).then(canvas => {
            try {
                const dataURL = canvas.toDataURL("image/jpeg", 0.95);
                const link = document.createElement("a");
                const timestamp = new Date().toISOString().split('T')[0];
                const metricLabel = currentMetric === "ytd" ? "YTD" : "Listing";

                link.download = `IPO-Analysis-2025-${metricLabel}-${timestamp}.jpg`;
                link.href = dataURL;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (err) {
                console.error("Link creation/click failed:", err);
            }

            btn.innerHTML = originalContent;
            btn.disabled = false;
        }).catch(err => {
            console.error("html2canvas failed:", err);
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed';
            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }, 2000);
        });
    }, 100);
}

// Setup Listeners
d3.select("#download-btn").on("click", downloadDashboard);

init();
