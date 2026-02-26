#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright 2014 The moOde audio player project / Tim Curtis
#
# Monitors the tidal-connect service for track changes and sends
# metadata to the moOde frontend via send-fecmd.php.
#
# Metadata format (~~~-delimited):
# [0]:title [1]:artist [2]:album [3]:duration_ms [4]:cover_url [5]:format
#

import subprocess
import time
import os
import sys
import json
import signal

TIDALMETA_FILE = '/var/local/www/tidalmeta.txt'
TIDALACTIVE_CMD = "sqlite3 /var/local/www/db/moode-sqlite3.db \"SELECT value FROM cfg_system WHERE param='tidalactive'\""
SEND_FECMD = '/var/www/util/send-fecmd.php'
LOG_FILE = '/var/log/moode_tidalevent.log'

def log(msg):
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(time.strftime('%Y-%m-%d %H:%M:%S') + ' tidalmeta: ' + msg + '\n')
    except Exception:
        pass

def is_tidal_active():
    try:
        result = subprocess.run(TIDALACTIVE_CMD, shell=True, capture_output=True, text=True)
        return result.stdout.strip() == '1'
    except Exception:
        return False

def send_fecmd(cmd):
    try:
        subprocess.run([SEND_FECMD, cmd], timeout=5)
    except Exception as e:
        log('send_fecmd error: ' + str(e))

def write_metadata(title, artist, album, duration_ms, cover_url, fmt):
    metadata = '~~~'.join([
        str(title),
        str(artist),
        str(album),
        str(duration_ms),
        str(cover_url),
        str(fmt)
    ])
    try:
        with open(TIDALMETA_FILE + '.tmp', 'w') as f:
            f.write(metadata)
        os.rename(TIDALMETA_FILE + '.tmp', TIDALMETA_FILE)
    except Exception as e:
        log('write_metadata error: ' + str(e))
    return metadata

def get_tidal_metadata():
    """
    Attempt to read metadata from tidal-connect process output.
    tidal-connect may write JSON events to stdout/stderr or a log file.
    This implementation reads from the systemd journal for the tidal-connect service.
    """
    try:
        result = subprocess.run(
            ['journalctl', '-u', 'tidal-connect', '-n', '50', '--no-pager', '-o', 'cat'],
            capture_output=True, text=True, timeout=5
        )
        lines = result.stdout.strip().split('\n')
        title = ''
        artist = ''
        album = ''
        duration_ms = 0
        cover_url = ''
        fmt = 'FLAC'

        for line in reversed(lines):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if 'title' in data:
                    title = data.get('title', '')
                    artist = data.get('artist', data.get('artists', ''))
                    album = data.get('album', '')
                    duration_ms = data.get('duration', data.get('duration_ms', 0))
                    cover_url = data.get('cover', data.get('cover_url', data.get('image_url', '')))
                    fmt = data.get('format', 'FLAC')
                    break
            except (json.JSONDecodeError, ValueError):
                pass

        return title, artist, album, duration_ms, cover_url, fmt
    except Exception as e:
        log('get_tidal_metadata error: ' + str(e))
        return '', '', '', 0, '', 'FLAC'

def main():
    log('started')

    last_title = None
    last_artist = None

    def handle_signal(signum, frame):
        log('stopped (signal ' + str(signum) + ')')
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    # Initialize metadata file if it doesn't exist
    if not os.path.exists(TIDALMETA_FILE):
        write_metadata('', '', '', 0, '', 'FLAC')

    while True:
        try:
            if not is_tidal_active():
                time.sleep(2)
                continue

            title, artist, album, duration_ms, cover_url, fmt = get_tidal_metadata()

            if title != last_title or artist != last_artist:
                last_title = title
                last_artist = artist
                metadata = write_metadata(title, artist, album, duration_ms, cover_url, fmt)
                log('track change: ' + title + ' - ' + artist)
                send_fecmd('update_tidalmeta,' + metadata)

            time.sleep(2)
        except Exception as e:
            log('main loop error: ' + str(e))
            time.sleep(5)

if __name__ == '__main__':
    main()
