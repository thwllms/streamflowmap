import urllib2
import json
import pymongo

STATES = ['AL', 'AK', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DE', 
          'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 
          'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO',
          'MS' ,'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM',
          'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 
          'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI',
          'WV', 'WY']

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

class EmptyStatsFileException(Exception):
    pass

def check_stats_mismatch(stats):
    # Check if there's data missing from any columns.
    fields = stats.keys()
    maxlen = max([len(stats[field]) for field in fields])
    minlen = min([len(stats[field]) for field in fields])
    if maxlen != minlen:
        return 'True (min col len: ' + str(minlen) + ', max col len: ' + str(maxlen) + ')'
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

def load_mongodb(station, stats, mongo_collection):
    # Update mongodb with stats for a given station.
    fields = stats.keys()
    try:
        # Check if the stats file is empty. Common problem. If empty, 
        # print error message.
        station = stats['site_no'][0]
    except IndexError:
        #print '\t' + station + '\tEmpty stats file.'
        raise EmptyStatsFileException('Empty stats file for ' + station)
    for i in range(0, len(stats['site_no'])):
        month = stats['month_nu'][i]
        day = stats['day_nu'][i]
        param = stats['parameter_cd'][i]
        date_param = {'month': month,
                      'day': day,
                      'param': param}
        data = {station:{}}
        for field in fields:
            if field in ['min_va',
                         'p05_va',
                         'p10_va',
                         'p20_va',
                         'p25_va',
                         'p50_va',
                         'p75_va',
                         'p80_va',
                         'p90_va',
                         'p95_va',
                         'max_va']:
                try:
                    data[station][field] = stats[field][i]
                except IndexError:
                    None
        mongo_collection.update(date_param, {'$set': data}, upsert=True)

def main(load_mongo=True):
    if load_mongo==True:
        client = pymongo.MongoClient()
        db = client.test_database
        if 'usgs_stats' not in db.collection_names():
            db.create_collection('usgs_stats')
        usgs_stats = db.usgs_stats
    for state in STATES:
        data = get_state_data(state)
        stations = get_list_of_stations(data)
        for station in stations:
            try:
                stats = get_stats(station)
                mismatch = check_stats_mismatch(stats)
                if mismatch == False:
                    print '\t'.join([state, station])
                else:
                    print '\t'.join([state, station, '\tMissing data.'])
                if load_mongo==True:
                    load_mongodb(station, stats, usgs_stats)
            except MissingStatsException:
                print '\t'.join([state, station, '\tFailed to get stats.'])            
            except EmptyStatsFileException:
                print '\t'.join([state, station, '\tEmpty stats file.'])

if __name__ == '__main__':
    main(True)
