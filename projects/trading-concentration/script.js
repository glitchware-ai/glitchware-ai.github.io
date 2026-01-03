const margin = { top: 60, right: 180, bottom: 40, left: 180 };
const width = document.getElementById('chart').clientWidth - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Colors for the ranges - Premium palette for light theme
const colors = d3.scaleOrdinal()
    .range(["#10b981", "#06b6d4", "#6366f1", "#a855f7", "#f43f5e", "#eab308"]);

// Embedded data to avoid CORS issues with local file access
const csvData = `Turnover range,Share in turnover,Share in investors
"<= Rs 10,000",0.03,32
"Rs 10,000 - Rs 1 lakh",0.4,38
"Rs 1 lakh - Rs 10 lakh",2,21
"Rs 10 lakh - Rs 1 crore",7,7
"Rs 1 crore - Rs 10 crore",13,1.5
"> Rs 10 crore",78,0.2`;

const data = d3.csvParse(csvData);

// Process data
data.forEach(d => {
    d.turnover = +d["Share in turnover"];
    d.investors = +d["Share in investors"];
});

// Calculate vertical positions for both sides
let currentY_L = 0;
let currentY_R = 0;
const totalHeight = height;

const sumL = d3.sum(data, d => d.investors);
const sumR = d3.sum(data, d => d.turnover);

data.forEach((d, i) => {
    // Higher minimum height to ensure label readability and clear visibility
    const minHeight = 32;
    const gap = 12;

    d.hL = Math.max((d.investors / sumL) * totalHeight, minHeight);
    d.hR = Math.max((d.turnover / sumR) * totalHeight, minHeight);

    d.yL = currentY_L;
    d.yR = currentY_R;

    currentY_L += d.hL + gap;
    currentY_R += d.hR + gap;

    d.color = colors(i);
});

// Re-adjust total heights to fit strictly within the container
const finalScaleL = totalHeight / (currentY_L - 12);
const finalScaleR = totalHeight / (currentY_R - 12);

data.forEach(d => {
    d.yL *= finalScaleL;
    d.hL *= finalScaleL;
    d.yR *= finalScaleR;
    d.hR *= finalScaleR;
});

// Draw Links
const linkGenerator = (d) => {
    const sourceX = 10;
    const targetX = width - 10;
    const sourceY1 = d.yL;
    const sourceY2 = d.yL + d.hL;
    const targetY1 = d.yR;
    const targetY2 = d.yR + d.hR;

    const cp1x = width * 0.4;
    const cp2x = width * 0.6;

    return `M ${sourceX} ${sourceY1} 
            C ${cp1x} ${sourceY1} ${cp2x} ${targetY1} ${targetX} ${targetY1} 
            L ${targetX} ${targetY2} 
            C ${cp2x} ${targetY2} ${cp1x} ${sourceY2} ${sourceX} ${sourceY2} 
            Z`;
};

// Add gradients for links
const defs = svg.append("defs");
data.forEach((d, i) => {
    const grad = defs.append("linearGradient")
        .attr("id", `grad-${i}`)
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "0%");

    // Increased opacity for permanent visibility
    grad.append("stop").attr("offset", "0%").attr("stop-color", d.color).attr("stop-opacity", 0.7);
    grad.append("stop").attr("offset", "100%").attr("stop-color", d.color).attr("stop-opacity", 0.3);
});

svg.selectAll(".link")
    .data(data)
    .enter()
    .append("path")
    .attr("class", "link")
    .attr("d", linkGenerator)
    .attr("fill", (d, i) => `url(#grad-${i})`)
    .attr("stroke", d => d.color)
    .attr("stroke-width", 0.5)
    .attr("stroke-opacity", 0.4)
    .on("mouseover", function (event, d) {
        d3.select(this).transition().duration(200).attr("fill-opacity", 1).style("stroke-opacity", 1);
        tooltip.transition().duration(200).style("opacity", 1);
        tooltip.html(`
            <div class="tooltip-title">${d["Turnover range"]}</div>
            <div class="tooltip-row">
                <span>Share in Investors:</span>
                <span class="tooltip-value" style="color:#0f172a">${d.investors}%</span>
            </div>
            <div class="tooltip-row">
                <span>Share in Turnover:</span>
                <span class="tooltip-value" style="color:${d.color}">${d.turnover}%</span>
            </div>
        `)
            .style("left", (event.pageX) + "px")
            .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function () {
        d3.select(this).transition().duration(500).attr("fill-opacity", 0.6).style("stroke-opacity", 0.4);
        tooltip.transition().duration(500).style("opacity", 0);
    });

// Draw Nodes
svg.selectAll(".node-left")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "node-left")
    .attr("x", -5)
    .attr("y", d => d.yL)
    .attr("width", 10)
    .attr("height", d => d.hL)
    .attr("fill", d => d.color)
    .attr("rx", 4);

svg.selectAll(".label-left")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "node-label")
    .attr("x", -20)
    .attr("y", d => d.yL + d.hL / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .style("fill", "#334155")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .text(d => d["Turnover range"])
    .style("opacity", d => d.hL > 12 ? 1 : 0.7);

svg.selectAll(".node-right")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "node-right")
    .attr("x", width - 5)
    .attr("y", d => d.yR)
    .attr("width", 10)
    .attr("height", d => d.hR)
    .attr("fill", d => d.color)
    .attr("rx", 4);

svg.selectAll(".label-right")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "node-label")
    .attr("x", width + 20)
    .attr("y", d => d.yR + d.hR / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .style("fill", "#0f172a")
    .style("font-size", "13px")
    .style("font-weight", "800")
    .text(d => `${d.turnover}%`)
    .style("fill", d => d.color)
    .style("opacity", d => d.hR > 8 ? 1 : 0.8);
