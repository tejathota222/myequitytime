document.addEventListener("DOMContentLoaded", () => {
    // ----------------- Plotly Charts -----------------
    fetch('/api/nifty_data')
    .then(res => res.json())
    .then(data => {
        // Candlestick Chart
        const candle = {
            x: data.date,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            type: 'candlestick',
            name: 'Nifty 50',
            increasing: {line: {color: 'green'}},
            decreasing: {line: {color: 'red'}}
        };

        // Moving Average (20-day)
        const ma20 = {
            x: data.date,
            y: data.close.map((v, i, arr) => {
                if (i < 20) return null;
                const slice = arr.slice(i - 20, i);
                return slice.reduce((a, b) => a + b, 0) / 20;
            }),
            type: 'scatter',
            mode: 'lines',
            name: 'MA 20',
            line: {color: 'blue'}
        };

        const layoutCandle = {
            title: 'Nifty 50 - Daily Candlestick',
            xaxis: {rangeslider: {visible: false}},
            yaxis: {title: 'Price (INR)'},
            plot_bgcolor: "#fafafa"
        };

        Plotly.newPlot('candlestick', [candle, ma20], layoutCandle);

        // Volume Chart
        const volume = {
            x: data.date,
            y: data.volume,
            type: 'bar',
            marker: {color: 'rgba(100,150,255,0.6)'},
            name: 'Volume'
        };

        const layoutVol = {
            title: 'Trading Volume',
            xaxis: {title: 'Date'},
            yaxis: {title: 'Volume'},
            plot_bgcolor: "#fafafa"
        };

        Plotly.newPlot('volume', [volume], layoutVol);
    })
    .catch(err => console.error("Error fetching Nifty data:", err));

    // ----------------- Run Analysis Table -----------------
    const runBtn = document.getElementById("runBtn");
    if (runBtn) {
        runBtn.addEventListener("click", () => { 
            const loading = document.getElementById("loading");
            const tbody = document.querySelector("#resultsTable tbody");
            tbody.innerHTML = "";
            loading.style.display = "block";

            fetch("/run-analysis")
              .then(res => res.json())
              .then(data => {
                loading.style.display = "none";
                data.forEach(row => {
                  const tr = document.createElement("tr");
                  tr.innerHTML = `
                    <td>${row.Ticker}</td>
                    <td>${row["High>Open>Low%"].toFixed(2)}%</td>
                    <td>${row["High=Open>Low%"].toFixed(2)}%</td>
                    <td>${row["Low<Open%"].toFixed(2)}%</td>
                    <td>${row["Low=Open%"].toFixed(2)}%</td>
                    <td>${row["High>Open%"].toFixed(2)}%</td>
                    <td>${row["High=Open%"].toFixed(2)}%</td>
                    <td>${row.Signal}</td>
                  `;
                  tbody.appendChild(tr);
                });
              })
              .catch(err => {
                  loading.style.display = "none";
                  alert("Error fetching analysis: " + err);
              });
        });
    }
});

const tickerDiv = document.getElementById("stock-ticker");
let scrollPos = 0;
let tickerParts = []; // store latest valid stock strings

// Fetch stock data
async function fetchTickerData() {
    try {
        const res = await fetch("/api/nifty_ticker");
        const stocks = await res.json();

        if (!stocks || stocks.length === 0) {
            console.warn("No stock data");
            return;
        }

        // Filter valid stocks
        const validStocks = stocks.filter(stock => typeof stock.price === "number" && stock.price > 0);
        if (validStocks.length === 0) return;

        // Build ticker parts
        tickerParts = validStocks.map(stock => {
            let price = stock.price.toFixed(2);
            let change = (typeof stock.change === "number" && !isNaN(stock.change)) ? stock.change.toFixed(2) : "–";
            let arrow = stock.arrow || "";
            let color = stock.color || "white";
            return `${stock.symbol}: ${price} <span style="color:${color}">${arrow}${change}</span>`;
        });

        // Combine and duplicate for smooth scrolling
        tickerDiv.innerHTML = tickerParts.join("  |  ") + "  |  " + tickerParts.join("  |  ");

    } catch (err) {
        console.error("Error fetching ticker:", err);
    }
}

function animateTicker() {
    if (!tickerContent) return;

    scrollPos -= 0.01; // super slow, readable
    if (Math.abs(scrollPos) >= tickerDiv.scrollWidth / 2) scrollPos = 0;

    tickerDiv.style.transform = `translateX(${scrollPos}px)`;

    requestAnimationFrame(animateTicker);
}

// Start ticker
fetchTickerData();                     // initial fetch
setInterval(fetchTickerData, 15000);  // refresh every 15s without jumping
animateTicker();