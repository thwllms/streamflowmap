import urllib2
import json
import pymongo

STATES = ['Al', 'AK', 'AZ']

def build_live_data_url(state):
    # Build url for the live data service by state.
    url_begin = 'http://waterservices.usgs.gov/nwis/iv/?stateCd='
    url_end = '&format=json'
    url = url_begin + state + url_end  
    return url

def get_state_data(state):
    # Download live JSON data for a state and parse.
    data_url = build_live_data_url(state)
    data = urllib2.urlopen(data_url).read()
    parsed_data = json.loads(data)
    return parsed_data

def get_list_of_stations(parsed_data):
    # Extract list of stations numbers from parsed data.
    stations = {}
    time_series = parsed_data['value']['timeSeries']
    for i in time_series:
        site_number = i['sourceInfo']['siteCode'][0]['value']
        stations[site_number] = None
    station_list = stations.keys()
    return station_list

def build_stats_url(station):
    # Build stats service url for a station.
    url_begin = 'http://waterservices.usgs.gov/nwis/stat/?format=rdb&sites='
    url = url_begin + station
    return url

def get_raw_stats(station):
    # Download stats for a given station.
    data_url = build_stats_url(station)
    raw_stats = urllib2.urlopen(data_url).read()
    return raw_stats 

def parse_stats(raw_stats):
    # Parse tab-delimited stats file.
    lines = raw_stats.split('\n')
    blanks_removed = filter(lambda i: len(i) > 0, lines)
    filtered_lines = filter(lambda i: i[0]!='#', blanks_removed)
    if len(filtered_lines)==0:
        return {}

    parsed_stats = {}

    header = filtered_lines[0].split('\t')
    header_columns = {}
    n_col = 0
    for column in header:
        parsed_stats[column] = []
        header_columns[n_col] = column
        n_col += 1

    rows = filtered_lines[2:]
    for row in rows:
        row_values = row.split('\t')
        for i in range(0, len(row_values)):
            value = row_values[i]
            column = header_columns[i]
            parsed_stats[column].append(value)

    return parsed_stats

class MissingStatsException(Exception):
    pass

class MismatchedStatsException(Exception):
    pass

def check_stats_mismatch(stats):
    fields = stats.keys()
    maxlen = max([len(stats[field]) for field in fields])
    minlen = min([len(stats[field]) for field in fields])
    if maxlen != minlen:
        return 'True (' + str(minlen) + ', ' + str(maxlen) + ')'
    else:
        return False

def get_stats(station):
    # Get parsed stats for a given station.
    raw_stats = get_raw_stats(station)
    stats = parse_stats(raw_stats)
    if len(stats)==0:
        raise MissingStatsException('Failed to get stats for ' + station)
    #check_stats(stats)
    return stats

def load_mongodb(stats):
    # Update mongodb with stats for a given station.
    client = pymongo.MongoClient()
    db = client.test_database
    if 'usgs_stats' not in db.collection_names():
        db.create_collection('usgs_stats')
    usgs_stats = db.usgs_stats
    fields = stats.keys()
    try:
        station = stats['site_no'][0]
    except IndexError:
        print '\tEmpty stats file.'
    for i in range(0, len(stats['site_no'])):
        month = stats['month_nu'][i]
        day = stats['day_nu'][i]
        date = {'month': month,
                'day': day}
        data = {station:{}}
        for field in fields:
            try:
                data[station][field] = stats[field][i]
            except IndexError:
                #print '\t' + '\t'.join([station, stats['parameter_cd'][i], field, str(i)])
                None
        usgs_stats.update(date, {'$set': data}, upsert=True)

def test(load_mongo=True):
    for state in STATES:
        print state
        data = get_state_data(state)
        stations = get_list_of_stations(data)
        for station in stations:
            try:
                stats = get_stats(station)
                mismatch = check_stats_mismatch(stats)
                print '\t' + station + '\t' + str(mismatch) # + '\t' + str(stats.keys())
                if load_mongo==True:
                    load_mongodb(stats)
            except MissingStatsException:
                print '\t' + station + '\tFailed to get stats.'            

if __name__ == '__main__':
    test(True)
