import json, os, time, io
from flask import Flask, render_template, request, jsonify, send_file
import yfinance as yf
import pandas as pd
from datetime import datetime, time as dtime
from io import StringIO
from io import BytesIO 
from flask import Response
import json
import time
import pytz


app = Flask(__name__)

NEWS_FILE = "news.json"
LIKES = {}  # simple in-memory like counter

IST = pytz.timezone("Asia/Kolkata")


def is_market_open():
    now = datetime.now(IST).time()
    return dtime(9, 15) <= now <= dtime(15, 30)

def load_sidebar():
    with open("static/data/sidebar.json", encoding="utf-8") as f:
        return json.load(f)

# ---------------- Utility ---------------- #
def load_news():
    if not os.path.exists(NEWS_FILE):
        return []
    with open(NEWS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# ---------------- Home / News ---------------- #
@app.route("/")
def home():
    news = load_news()
    sidebar = load_sidebar()
    sidebar["market_snapshot"] = get_market_snapshot()
    return render_template("home.html", news=news, sidebar=sidebar)

@app.route("/news/<int:news_id>")
def show_news(news_id):
    news = load_news()
    article = next((n for n in news if n["id"] == news_id), None)
    if not article:
        return "News not found", 404
    likes = LIKES.get(news_id, 0)
    sidebar = load_sidebar()
    return render_template("news.html",news=news, article=article, likes=likes, sidebar=sidebar)

@app.route("/like/<int:news_id>", methods=["POST"])
def like_news(news_id):
    LIKES[news_id] = LIKES.get(news_id, 0) + 1
    return jsonify({"likes": LIKES[news_id]})

nifty_50 = [
    "ADANIENT.NS", "ADANIPORTS.NS", "APOLLOHOSP.NS", "ASIANPAINT.NS", "AXISBANK.NS",
    "BAJAJ-AUTO.NS", "BAJFINANCE.NS", "BAJAJFINSV.NS", "BPCL.NS", "BHARTIARTL.NS",
    "BRITANNIA.NS", "CIPLA.NS", "COALINDIA.NS", "DIVISLAB.NS", "DRREDDY.NS",
    "EICHERMOT.NS", "GRASIM.NS", "HCLTECH.NS", "HDFCBANK.NS", "HDFCLIFE.NS",
    "HEROMOTOCO.NS", "HINDALCO.NS", "HINDUNILVR.NS", "ICICIBANK.NS", "ITC.NS",
    "INDUSINDBK.NS", "INFY.NS", "JSWSTEEL.NS", "KOTAKBANK.NS", "LTIM.NS",
    "LT.NS", "M&M.NS", "MARUTI.NS", "NTPC.NS", "NESTLEIND.NS", "ONGC.NS",
    "POWERGRID.NS", "RELIANCE.NS", "SBILIFE.NS", "SBIN.NS", "SUNPHARMA.NS",
    "TCS.NS", "TATACONSUM.NS", "TATAMOTORS.NS", "TATASTEEL.NS", "TECHM.NS",
    "TITAN.NS", "UPL.NS", "ULTRACEMCO.NS", "WIPRO.NS", "PFC.NS"
]

last_snapshot = {}

def get_market_snapshot():
    global last_snapshot
    try:
        if is_market_open():
            sensex_data = yf.Ticker("^BSESN").history(period="1d", interval="1m").tail(2)
            nifty_data  = yf.Ticker("^NSEI").history(period="1d", interval="1m").tail(2)

            def format_with_change(df):
                if len(df) < 2:
                    return f"{df['Close'].iloc[-1]:,.2f}"
                latest = df['Close'].iloc[-1]
                prev   = df['Close'].iloc[-2]
                diff   = latest - prev
                arrow  = "▲" if diff > 0 else "▼" if diff < 0 else "⏺"
                return f"{latest:,.2f} {arrow} {abs(diff):.2f}"

            snapshot = {
                "Sensex": format_with_change(sensex_data),
                "Nifty": format_with_change(nifty_data),
                "USD/INR": "82.20"
            }
            last_snapshot = snapshot
            return snapshot
        else:
            # After 3:30 → keep last known snapshot
            return last_snapshot if last_snapshot else {
                "Sensex": "Market Closed",
                "Nifty": "Market Closed",
                "USD/INR": "82.20"
            }
    except Exception as e:
        print("Error fetching market data:", e)
        return last_snapshot if last_snapshot else {
            "Sensex": "N/A",
            "Nifty": "N/A",
            "USD/INR": "N/A"
        }

@app.route("/api/market_snapshot")
def market_snapshot():
    return jsonify(get_market_snapshot())


# ---- Nifty Ticker ---- #
last_ticker_data = []

@app.route("/api/nifty_ticker")
def nifty_ticker():
    global last_ticker_data
    try:
        if is_market_open():
            # Fetch only during market hours
            data = yf.download(
                tickers=nifty_50,
                period="2d",
                interval="1m",
                group_by='ticker',
                threads=True,
                progress=False
            )

            result = []
            for symbol in nifty_50:
                try:
                    # Handle dict or multi-index DataFrame
                    if isinstance(data, dict):
                        hist = data.get(symbol)
                    else:
                        hist = data.loc[:, (symbol, "Close")] if (symbol, "Close") in data.columns else None
                        if hist is not None:
                            hist = hist.dropna()

                    if hist is not None and len(hist) >= 2:
                        prev = hist.iloc[-2]
                        latest = hist.iloc[-1]
                        change = round(latest - prev, 2)
                        arrow = "▲" if change > 0 else "▼" if change < 0 else ""
                        color = "green" if change > 0 else "red" if change < 0 else "white"

                        result.append({
                            "symbol": symbol.split('.')[0],
                            "price": float(latest),
                            "change": float(change),
                            "arrow": arrow,
                            "color": color
                        })
                except Exception as inner_e:
                    print(f"Error processing {symbol}: {inner_e}")

            # ✅ Save fresh snapshot while open
            if result:
                last_ticker_data = result
            return jsonify(result if result else last_ticker_data)

        else:
            # ✅ After 3:30 → return last known values (frozen)
            return jsonify(last_ticker_data if last_ticker_data else [])

    except Exception as e:
        print("Error fetching Nifty data:", e)
        return jsonify(last_ticker_data if last_ticker_data else [])


def get_stock_data(ticker, start_date):
    end_date = datetime.now().strftime('%Y-%m-%d')
    data = yf.download(ticker, start=start_date, end=end_date, progress=False, auto_adjust=False)
    return data

def calculate_metrics(data, ticker):
    if data is None or len(data) == 0:
        return None

    diff_high_open = data["High"] - data["Open"]
    diff_open_low = data["Open"] - data["Low"]

    price_equality = {
        'High=Open%': (diff_high_open == 0).mean() * 100,
        'High>Open%': (diff_high_open > 0).mean() * 100,
        'High>Open>Low%': ((diff_high_open > 0) & (diff_open_low > 0)).mean() * 100,
        'High=Open>Low%': ((diff_high_open == 0) & (diff_open_low > 0)).mean() * 100,
        'Low=Open%': (diff_open_low == 0).mean() * 100,
        'Low<Open%': (diff_open_low > 0).mean() * 100
    }

    metrics = {'Ticker': ticker.replace(".NS", "")}
    metrics.update({k: float(v) for k, v in price_equality.items()})

    # Add Signal
    metrics['Signal'] = 'BUY' if metrics['High>Open%'] > metrics['Low<Open%'] else 'SELL'

    return metrics

@app.route("/api/run_analysis")
def run_analysis():
    start_date = request.args.get("start", "2008-01-01")

    def generate():
        total = len(nifty_50)
        for i, ticker in enumerate(nifty_50):
            try:
                data = get_stock_data(ticker, start_date)
                metrics = calculate_metrics(data, ticker)
            except Exception as e:
                metrics = None
                print(f"Error fetching {ticker}: {e}")

            yield json.dumps({
                "type": "stock",
                "data": metrics,
                "index": i,
                "total": total
            }) + "\n"

            time.sleep(0.1)  # avoid rate limits

        yield json.dumps({"type": "done"}) + "\n"

    # Important headers to help streaming in browser
    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
    }

    return Response(generate(), headers=headers)



@app.route("/download_csv")
def download_csv():
    start_date = request.args.get("start", "2008-01-01")
    results = []
    for ticker in nifty_50:
        data = get_stock_data(ticker, start_date)
        metrics = calculate_metrics(data, ticker)
        if metrics:
            results.append(metrics)
    df = pd.DataFrame(results)

    # Convert CSV to bytes
    csv_bytes = df.to_csv(index=False).encode('utf-8')

    return send_file(
        BytesIO(csv_bytes),            # Use BytesIO for binary stream
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"nifty_50_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
)

# ---------------- Analysis Pages ---------------- #
@app.route("/analysis")
def stock_analysis():
    return render_template("analysis.html", title="Stock Analysis")

@app.route("/time-series")
def time_series():
    return render_template("time_series.html", title="Time Series Analysis")

@app.route("/market-prediction")
def market_prediction():
    return render_template("prediction.html", title="Market Prediction")

# ---------------- Math Placeholder ---------------- #
@app.route("/math")
def math_area():
    return render_template("math.html")

if __name__ == "__main__":
    app.run(debug=True)

