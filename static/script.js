// 🔹 Top banner auto-slide (slide left)
document.querySelectorAll(".top-carousel").forEach(carousel => {
  const slides = carousel.querySelectorAll(".slide");
  const total = slides.length;
  let index = 0;

  // Wrap slides in a flex container
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.width = `${total * 100}%`;
  wrapper.style.transition = "transform 0.8s ease-in-out";
  wrapper.style.height = "100%";

  slides.forEach(slide => {
    slide.style.width = `${100 / total}%`;
    slide.style.display = "block";
    slide.style.position = "relative";
    wrapper.appendChild(slide);
  });

  carousel.innerHTML = "";
  carousel.appendChild(wrapper);

  setInterval(() => {
    index = (index + 1) % total;
    wrapper.style.transform = `translateX(-${index * (100 / total)}%)`;
  }, 3000);
});

// 🔹 Rectangle carousel (slide left)
document.querySelectorAll(".rectangle-carousel").forEach(carousel => {
  const rSlides = carousel.querySelectorAll(".rect-slide");
  const total = rSlides.length;
  let rIndex = 0;

  // Wrap all slides in a container for smooth transform
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.width = `${total * 100}%`;
  wrapper.style.transition = "transform 0.8s ease-in-out";
  wrapper.style.height = "100%";
  
  rSlides.forEach(slide => {
    slide.style.width = `${100 / total}%`;
    slide.style.display = "block"; // override absolute
    slide.style.position = "relative";
    wrapper.appendChild(slide);
  });
  carousel.innerHTML = "";
  carousel.appendChild(wrapper);

  setInterval(() => {
    rIndex = (rIndex + 1) % total;
    wrapper.style.transform = `translateX(-${rIndex * (100 / total)}%)`;
  }, 4000);
});

// 🔹 Square carousel (slide left)
document.querySelectorAll(".square-carousel").forEach(carousel => {
  const sSlides = carousel.querySelectorAll(".square-slide");
  const total = sSlides.length;
  let sIndex = 0;

  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.width = `${total * 100}%`;
  wrapper.style.transition = "transform 0.8s ease-in-out";
  wrapper.style.height = "100%";

  sSlides.forEach(slide => {
    slide.style.width = `${100 / total}%`;
    slide.style.display = "block";
    slide.style.position = "relative";
    wrapper.appendChild(slide);
  });

  carousel.innerHTML = "";
  carousel.appendChild(wrapper);

  setInterval(() => {
    sIndex = (sIndex + 1) % total;
    wrapper.style.transform = `translateX(-${sIndex * (100 / total)}%)`;
  }, 4000);
});








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

