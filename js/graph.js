/**
 * SEC-CENTER - Node Graph Module
 * Uses D3.js for force-directed graph rendering.
 */

window.SecGraph = (function() {
  let isDrawn = false;

  const mockNodes = [
    { id: "APT28", group: 1, type: "Actor" },
    { id: "Lazarus", group: 1, type: "Actor" },
    { id: "FIN7", group: 1, type: "Actor" },
    { id: "Ryuk", group: 2, type: "Malware" },
    { id: "Emotet", group: 2, type: "Malware" },
    { id: "TrickBot", group: 2, type: "Malware" },
    { id: "Cobalt Strike", group: 2, type: "Tool" },
    { id: "192.168.1.100", group: 3, type: "IP" },
    { id: "10.0.0.5", group: 3, type: "IP" },
    { id: "45.33.22.11", group: 3, type: "IP" },
    { id: "malicious-site.com", group: 4, type: "Domain" },
    { id: "c2-server.net", group: 4, type: "Domain" }
  ];

  const mockLinks = [
    { source: "APT28", target: "Emotet", value: 2 },
    { source: "APT28", target: "Cobalt Strike", value: 5 },
    { source: "Lazarus", target: "Ryuk", value: 4 },
    { source: "FIN7", target: "TrickBot", value: 3 },
    { source: "FIN7", target: "Cobalt Strike", value: 6 },
    { source: "Emotet", target: "192.168.1.100", value: 1 },
    { source: "TrickBot", target: "10.0.0.5", value: 1 },
    { source: "Ryuk", target: "45.33.22.11", value: 2 },
    { source: "Cobalt Strike", target: "c2-server.net", value: 8 },
    { source: "APT28", target: "malicious-site.com", value: 2 },
    { source: "malicious-site.com", target: "192.168.1.100", value: 1 }
  ];

  function draw(containerId) {
    if (!window.d3) {
      console.error("[SecGraph] D3.js is not loaded.");
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Create SVG
    const svg = d3.select(container).append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("background", "transparent")
      .call(d3.zoom().on("zoom", (event) => {
        g.attr("transform", event.transform);
      }));

    const g = svg.append("g");

    // Simulation
    const simulation = d3.forceSimulation(mockNodes)
      .force("link", d3.forceLink(mockLinks).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(30));

    // Links
    const link = g.append("g")
      .attr("stroke", "rgba(0, 240, 255, 0.3)")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(mockLinks)
      .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value));

    // Colors
    const color = d3.scaleOrdinal()
      .domain([1, 2, 3, 4])
      .range(["#ff3366", "#ff8800", "#00ff88", "#00f0ff"]);

    // Nodes
    const node = g.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(mockNodes)
      .join("circle")
      .attr("r", d => d.group === 1 ? 12 : 8)
      .attr("fill", d => color(d.group))
      .call(drag(simulation));

    // Labels
    const labels = g.append("g")
      .selectAll("text")
      .data(mockNodes)
      .join("text")
      .text(d => d.id)
      .attr("font-size", "10px")
      .attr("fill", "#e0e8ff")
      .attr("dx", 15)
      .attr("dy", 4);

    // Tooltip behavior
    node.on("mouseover", function(event, d) {
      d3.select(this).attr("stroke", "#fff").attr("stroke-width", 3);
      if (window.SecAudio) window.SecAudio.playClick();
    })
    .on("mouseout", function(event, d) {
      d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1.5);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
        
      labels
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

    // Drag functions
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
  }

  return { draw };
})();
