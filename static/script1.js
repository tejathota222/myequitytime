let autoRefreshTimer = null;
let countdownTimer = null;
let autoRefreshRunning = false;
let summaryChart = null;


//let allResults = [];
// Main analysis function
async function runAnalysis() {
    const start = document.getElementById("startDate").value;
    const showProgress = document.getElementById("showProgress").checked;

    const progressText = document.getElementById("progressText");
    const progressFill = document.getElementById("progressFill");
    const tbody = document.querySelector("#resultsTable tbody");
    tbody.innerHTML = "";

    progressText.innerText = "Starting analysis...";
    progressFill.style.width = "0%";
    //allResults = []; 

    try {
        const response = await fetch(`/api/run_analysis?start=${start}&progress=${showProgress}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let { value, done } = await reader.read();
        let buffer = "";

        while (!done) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (let line of lines) {
                if (!line.trim()) continue;
                const msg = JSON.parse(line);

                if (msg.type === "stock" && msg.data) {
                    const row = msg.data;
                    const tr = document.createElement("tr");
                    tr.className = row.Signal === "BUY" ? "buy" : "sell";

                    const keys = ["Ticker","High>Open>Low%","High=Open>Low%","Low<Open%","Low=Open%","High>Open%","High=Open%"];
                    for (let key of keys) {
                        const td = document.createElement("td");
                        td.innerText = row[key];
                        tr.appendChild(td);
                    }

                    const tdSignal = document.createElement("td");
                    tdSignal.innerText = row.Signal;
                    tdSignal.className = "signal-blink";
                    tr.appendChild(tdSignal);

                    tbody.appendChild(tr);

                    // Update progress bar
                    const percent = Math.round(((msg.index + 1) / msg.total) * 100);
                    progressFill.style.width = percent + "%";
                    progressText.innerText = `Processing: ${msg.index + 1}/${msg.total} stocks (${percent}%)`;
                } else if (msg.type === "done") {
                    progressText.innerText = "Analysis complete!";
                    progressFill.style.width = "100%";

                    showSummary();;
                }
            }

            ({ value, done } = await reader.read());
        }
    } catch (err) {
        progressText.innerText = "Error during analysis!";
        console.error(err);
    }
}

// Download CSV
function downloadCSV() {
    const start = document.getElementById("startDate").value;
    window.location.href = `/download_csv?start=${start}`;
}

// Show summary chart based on table
function showSummary() {
    const tbody = document.querySelector("#resultsTable tbody");
    const rows = tbody.querySelectorAll("tr");

    let buyCount = 0;
    let sellCount = 0;

    rows.forEach(row => {
        const signalCell = row.cells[row.cells.length - 1]; // last cell is Signal
        if (signalCell.innerText === "BUY") buyCount++;
        else if (signalCell.innerText === "SELL") sellCount++;
    });

    // Display counts above chart
    const summaryTitle = document.getElementById("summaryTitle");
    summaryTitle.style.display = "block";
    summaryTitle.innerText = `📊 Summary Chart - Total BUY: ${buyCount}, Total SELL: ${sellCount}`;

    const chartCanvas = document.getElementById('summaryChart');
    chartCanvas.style.display = "block";
    document.getElementById('downloadChartBtn').style.display = "inline-block";

    const ctx = chartCanvas.getContext('2d');

    if (summaryChart) summaryChart.destroy();

    summaryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['BUY', 'SELL'],
            datasets: [{
                data: [buyCount, sellCount],
                backgroundColor: ['#4CAF50', '#F44336'],
                borderWidth: 1
            }]
        },
        options: {
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.raw + ' stocks';
                        }
                    }
                }
            }
        }
    });
}

function downloadChartImage() {
    if (!summaryChart) return;
    const link = document.createElement('a');
    link.href = summaryChart.toBase64Image();
    link.download = `nifty_50_summary_${new Date().toISOString()}.png`;
    link.click();
}


// Countdown Timer
function startCountdown(seconds) {
    const countdownEl = document.getElementById("countdownTimer");
    let remaining = seconds;

    if (countdownTimer) clearInterval(countdownTimer);

    countdownEl.innerText = `Next refresh: ${remaining}s`;
    countdownTimer = setInterval(() => {
        remaining--;
        countdownEl.innerText = `Next refresh: ${remaining}s`;
        if (remaining <= 0) clearInterval(countdownTimer);
    }, 1000);
}

// Auto-refresh
async function autoRefreshLoop() {
    if (autoRefreshRunning) return;
    autoRefreshRunning = true;
    await runAnalysis();
    autoRefreshRunning = false;
}

// Start Auto-refresh
function startAutoRefresh() {
    const intervalMinutes = parseInt(document.getElementById("refreshInterval").value);
    const intervalMs = intervalMinutes * 60 * 1000;

    autoRefreshLoop(); // Run immediately
    startCountdown(intervalMs / 1000);

    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
        autoRefreshLoop();
        startCountdown(intervalMs / 1000);
    }, intervalMs);
}

// Auto-refresh checkbox listener
document.getElementById("autoRefresh").addEventListener("change", function () {
    if (this.checked) {
        startAutoRefresh();
    } else {
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        if (countdownTimer) clearInterval(countdownTimer);
        document.getElementById("countdownTimer").innerText = "Next refresh: N/A";
    }
});
