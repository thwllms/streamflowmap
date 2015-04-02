from flask import Flask, send_from_directory
app = Flask(__name__, static_url_path='')

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/stats/month=<int:month>&day=<int:day>')
def get_stats(month, day):
    stats = None
    return stats

if __name__ == '__main__':
    app.run()
