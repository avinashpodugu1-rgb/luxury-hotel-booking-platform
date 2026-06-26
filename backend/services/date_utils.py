from datetime import date, datetime, timedelta


def parse_iso_date(value):
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(value).date()


def each_night(check_in, check_out):
    start = parse_iso_date(check_in)
    end = parse_iso_date(check_out)
    if end <= start:
        raise ValueError("check_out must be after check_in")
    nights = []
    current = start
    while current < end:
        nights.append(current.isoformat())
        current += timedelta(days=1)
    return nights


def each_date_inclusive(start_date, end_date):
    start = parse_iso_date(start_date)
    end = parse_iso_date(end_date)
    if end < start:
        raise ValueError("end_date must be on or after start_date")
    dates = []
    current = start
    while current <= end:
        dates.append(current.isoformat())
        current += timedelta(days=1)
    return dates