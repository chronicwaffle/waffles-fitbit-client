Get Sleep Log by Date

This endpoint returns a list of a user's sleep log entries for a given date. The data returned can include sleep periods that began on the previous date. For example, if you request a Sleep Log for 2021-12-22, it may return a log entry that began the previous night on 2021-12-21, but ended on 2021-12-22.

It uses units that correspond to the Accept-Language header provided.

Scope: sleep
Request
GET 	/1.2/user/[user-id]/sleep/date/[date].json

URI Arguments
user-id 	required 	The encoded ID of the user. Use "-" (dash) for current logged-in user.
date 	required 	The date for the sleep log to be returned in the format yyyy-MM-dd.

Request Headers
authorization 	required 	Specify the token type and Fitbit user’s access token.
Token type: Bearer
accept 	optional 	Defines the media type of the response content the client is expecting.
Supported: application/json
accept-language 	recommended 	The measurement unit system to use for response values. See Localization.
accept-locale 	optional 	The locale to use for response values. See Localization.

Examples

    URL
    CURL

GET https://api.fitbit.com/1.2/user/-/sleep/date/2020-01-01.json
GET https://api.fitbit.com/1.2/user/GGNJL9/sleep/date/2020-01-01.json

Response

    Description
    Example Response

Element Name 	Description
sleep : dateOfSleep 	The date the sleep log ended
sleep : duration 	Length of the sleep in milliseconds.
sleep : efficiency 	Calculated sleep efficiency score. See Sleep Efficiency Calculation.
sleep : endTime 	Time the sleep log ended.
sleep : infoCode 	An integer value representing the quality of data collected within the sleep log.

    0 = Sufficient data to generate a sleep log.
    1 = Insufficient heart rate data.
    2 = Sleep period was too short (less than 3 hours).
    3 = Server-side issue when generating the sleep log. No data impact.

sleep : isMainSleep 	Boolean value: true or false
sleep : levels : data : dateTime 	Timestamp the user started in sleep level.
sleep : levels : data : level 	The sleep level the user entered. The values returned for the sleep log type are:
classic: restless | asleep | awake
stages: deep | light | rem | wake
sleep : levels : data : seconds 	The length of time the user was in the sleep level. Displayed in seconds.
sleep : levels : shortData : dateTime 	Timestamp the user started in sleep level. Only supported when log type = stages.
sleep : levels : shortData : level 	The sleep level the user entered. Only supported when log type = stages.
sleep : levels : shortData : seconds 	The length of time the user was in the sleep level. Displayed in seconds.
sleep : levels : summary : [level] : count 	Total number of times the user entered the sleep level.
sleep : levels : summary : [level] : minutes 	Total number of minutes the user appeared in the sleep level.
sleep : levels : summary : [level] : thirtyDayAvgMinutes 	The average sleep stage time over the past 30 days. A sleep stage log is required to generate this value. When a classic sleep log is recorded, this value will be missing.
sleep : logId 	Sleep log ID.
sleep : minutesAfterWakeup 	The total number of minutes after the user woke up.
sleep : minutesAsleep 	The total number of minutes the user was asleep.
sleep : minutesAwake 	The total sum of "wake" minutes only. It does not include before falling asleep or after waking up.
sleep : minutesToFallAsleep 	The total number of minutes before the user falls asleep. This value is generally 0 for autosleep created sleep logs.
sleep : logType 	The type of sleep in terms of how it was logged. See "logType" for more detail.

Supported: auto_detected | manual
sleep : startTime 	Time the sleep log begins.
sleep : timeInBed 	Total number of minutes the user was in bed.
sleep : type 	The type of sleep log.
Supported : classic | stages
summary : stages : [level] 	
summary : totalMinutesAsleep 	Total number of minutes the user was asleep across all sleep records in the sleep log.
summary : totalSleepRecords 	The number of sleep records within the sleep log.
summary : totalTimeInBed 	Total number of minutes the user was in bed across all records in the sleep log.

Response Headers
content-type 	The media type of the response content being sent to the client.
Supported: application/json
fitbit-rate-limit-limit 	The quota number of calls.
fitbit-rate-limit-remaining 	The number of calls remaining before hitting the rate limit.
fitbit-rate-limit-reset 	The number of seconds until the rate limit resets.

    Note: The rate limit headers are approximate and asynchronously updated. This means that there may be a minor delay in the decrementing of remaining requests. This could result in your application receiving an unexpected 429 response if you don't track the total number of requests you make yourself. 


Response Type
HTTP Status Code 	HTTP response code. List of codes are found in the Troubleshooting Guide.
Status Message 	Description of the status code.
Response Body 	Contains the JSON response to the API call. When errors are returned by the API call, the errorType, fieldName and message text will provide more information to the cause of the failure.

Response Codes
200 	A successful request.
400 	The request had bad syntax or was inherently impossible to be satisfied.
401 	The request requires user authentication.

    Note: For a complete list of response codes, please refer to the Troubleshooting Guide.


Additional Information
Types of sleep logs

This endpoint supports two kinds of sleep log types:

    stages : Levels data is returned with 30-second granularity. 'Sleep Stages' levels include deep, light, rem, and wake.
    classic : Levels data returned with 60-second granularity. 'Sleep Pattern' levels include asleep, restless, and awake.

    Note: shortData is only included for stages sleep logs and includes wake periods that are 3 minutes or less in duration. This distinction is to simplify graphically distinguishing short wakes from longer wakes, but they are physiologically equivalent. 

For information on how to interpret the sleep data, see Interpreting the Sleep Stage and Short Data.
Sleep Efficiency Calculation

The sleep log response will return a sleep efficiency score. Sleep efficiency is supported for classic sleep logs, only. Even though a value may be returned for both classic and stage sleep logs, the sleep efficiency value returned for stages sleep logs should be ignored. Sleep efficiency for classic sleep logs uses the standard calculation of

sleep efficiency = minutesAsleep/timeInBed

    Note: The sleep efficiency score should not be confused with the sleep score returned by the mobile application, as they are calculated differently. Sleep score is not supported through the Web API. 

Device generated sleep logs

The dateOfSleep in the GET sleep log endpoint response is the date on which the sleep event ends. This means that requesting a sleep log for a given date, for example 2021-12-22, may return a log entry that began the previous night on 2021-12-21. This is to account for the fact that sleep periods typically take place overnight between two dates and the dateOfSleep refers to the date the user woke up.

If the wake time during the main sleep is greater than 1 hour, the sleep log will be split into 2 logs.

Although, if the device syncs during the wake time and consistent steps and hand movement occur for at least 15 minutes, then a sleep log might be generated for the first part of the sleep. The second part of the sleep will be detected when the device syncs in the morning. If the time between the 2 sleep logs is less than 1 hour, the 2 sleep logs will be stitched together.
Manually created Sleep Logs

A manual sleep log is either a sleep log that has human input through the mobile or web application, or a 3rd party application records sleep using the Create Sleep Log endpoint. When a sleep log is manually recorded, a "classic" sleep log is generated. Sleep "stage" logs use the device heart rate and movement to calculate sleep stage data. When manually entering a sleep log, this information is typically not available.

It is NOT possible to create overlapping logs.
"logType" values

This field returns information on whether the user’s sleep data was automatically or manually detected. It includes the following 2 values:

    auto_detected: Sleep was automatically detected by our sleep detection service.
    manual: Sleep was logged by the user or edited by the user after being automatically detected.

Meta response
Some of the sleep log processing occurs asynchronously. On rare occassions, your application may be querying the sleep logs while the sleep data is still being processed. If the sleep logs are still in a processing state, a "meta" response will be returned. This response will indicate a retry duration given in milliseconds. The "meta" response may evolve with additional fields in the future; API clients should be prepared to ignore any new object properties they do not recognize.

If the user has only 1 sleep log that is being processed, the response will contain only the meta field.

{
    "meta": {
        "retryDuration": 3000,
        "state": "pending"
    }
}

However, if there is a second sleep log present for that day, then the sleep, summary and meta fields will be returned.

{
    "meta": {
        "retryDuration": 3000,
        "state": "pending"
    }
    "sleep": [
        {{ existing sleep details }}
    ],
      "summary": {
    "stages": {
      "deep": 104,
      "light": 205,
      "rem": 75,
      "wake": 78
    },

    "summary": {
        stages: {
            "deep": 55,
            "light": 176,
            "rem": 65,
            "wake": 21
        }
        "totalMinutesAsleep": 296,
        "totalSleep Records": 2,
        "totalTimeInBed": 317
    }
}
