#!/usr/bin/env bash
#
# About self-hosting Google Fonts typefaces:
#
# In order to get the font files for self-hosting a webfont typeface a service
# can be used, like 'google-webfonts-helper'. It's available on GitHub, at
# # https://github.com/majodev/google-webfonts-helper and provides an easy way
# of getting the proper subsets and fonts from the Google Fonts project for
# self-hosting. It is not perfect, though, because by default it won't get a
# @font-face spec containing unicode-range property.
#
# The manual process is quite easy, in fact, it's just a matter of getting the
# CSS file from the Google Fonts project for the desired font family.
#
# The URL is this:
#   https://fonts.googleapis.com/css2?family=<family>:<axes>&subset=<subset>
#
# It's just a matter of replacing <family>, <axes> and <subset> as needed.
#
# The returned CSS will contain suitable @font-face specifications, including
# the URLs needed to download the actual font files.

# The only important point when getting this CSS is that the Google Fonts
# project will serve a different CSS depending on the User-Agent string used in
# the request. In order to get both woff2 support and unicode-range property
# support, the minimal User-Agent string working (to date) is 
UA="Firefox/999"
# but this may change in the future.
#
# Other valid User-Agent strings (supporting woff2) are the following:
#     UA="Mozilla/5.0 (Windows NT 6.3; rv:39.0) Gecko/20100101 Firefox/39.0"
#     From google-webfont-helper (https://github.com/majodev/google-webfonts-helper).
#     No unicode-range support.
#
#     UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36"
#     From gfonts.php (https://gist.github.com/nikoskip/bcf58106f728a3e7b7f9dcb6edaa1e82).
#     No unicode-range support.
#
#     UA="Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0"
#     From google-font-download BASH script (https://github.com/neverpanic/google-font-download).
#     No unicode-range support.
#
#     UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36"
#     From latest Google Chrome version (to date) for Windows 10.
#     Full unicode-range support.
#
# The returned CSS may contain @font-face specifications and URLs for subsets
# other than the requested, specially if unicode-range property is supported.
#
# In any case, after getting the CSS, it's just a matter of downloading the
# appropriate font files from the URLs contained in the CSS file and adapt
# the @font-face specifications as needed.
#
#
# This script performs all steps automatically, filtering the unneeded subsets
# and putting the resulting CSS and the downloaded font files in a directory
# named upon the font family.

if [[ -z "$1" ]];
then
    echo "*** ERROR: specify at least font family!"
    echo ""
    echo "Usage: $0 FONT_FAMILY [FONT_AXES [FONT_SUBSET]]"
    echo ""
    echo "(e.g. $0 Noto+Sans ital,wght@0,400;0,700;1,400;1,700 latin )"
    exit
fi

FONT_FAMILY="$1"
FONT_AXES="${2:-ital,wght@0,400;0,700;1,400;1,700}"
FONT_SUBSET="${3:-latin}"

FONT_STYLE=''
FONT_WEIGHT=''
FONT_RANGE=''
FONT_URL=''
FONT_CSS='fonts.css'

if [[ ! -d "$1" ]];
then
    mkdir -p "$1"
fi

cd "$1"

echo '' > "$FONT_CSS"
curl -sSf -A "$UA" --get "https://fonts.googleapis.com/css2?family=${FONT_FAMILY}:${FONT_AXES}&subset=${FONT_SUBSET}" | sed -n "/\/\* ${FONT_SUBSET} \*\//,/\}/p" | while read line
do
    line=${line// /}
    line=${line%;}
    if [[ "$line" == "font-style:"* ]];
    then
        FONT_STYLE=${line##font-style:}
    fi
    if [[ "$line" == "font-weight:"* ]];
    then
        FONT_WEIGHT=${line##font-weight:}
    fi
    if [[ "$line" == "src:url("* ]];
    then
        line=${line##src:url(}
        line=${line%%)format(\'woff2\')}
        FONT_URL=$line
    fi
    if [[ "$line" == "unicode-range:"* ]];
    then
        FONT_RANGE=${line##unicode-range:}
    fi
    if [[ "$FONT_STYLE" && "$FONT_WEIGHT" && "$FONT_RANGE" && "$FONT_URL" ]];
    then
        FONT_FILE="index_${FONT_STYLE:0:1}${FONT_WEIGHT}.woff2"
        curl -sSf -A "$UA" --get "$FONT_URL" -o $FONT_FILE
        (
            echo "@font-face {"
            echo "    font-family: 'Trujaman';"
            echo "    font-style: ${FONT_STYLE};"
            echo "    font-weight: ${FONT_WEIGHT};"
            echo "    src: url('$FONT_FILE') format('woff2');"
            echo "    unicode-range: $FONT_RANGE;"
            echo "}"
        ) >> $FONT_CSS
        FONT_STYLE=''
        FONT_WEIGHT=''
        FONT_URL=''
        FONT_RANGE=''
        FONT_FILE=''
    fi
done
