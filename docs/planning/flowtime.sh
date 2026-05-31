#!/bin/bash

start_time=$(date +%s)
paused=false
pause_time=0
total_pause=0

tput civis
stty -echo -icanon time 0 min 0

cleanup() {
    tput cnorm
    stty sane
    clear
    exit
}

trap cleanup INT TERM

while true; do

    # Leer tecla sin bloquear
    key=$(dd bs=1 count=1 2>/dev/null)

    case "$key" in
        p)
            if [ "$paused" = false ]; then
                paused=true
                pause_time=$(date +%s)
            else
                paused=false
                now=$(date +%s)
                total_pause=$((total_pause + now - pause_time))
            fi
            ;;
        r)
            start_time=$(date +%s)
            total_pause=0
            paused=false
            ;;
        q)
            cleanup
            ;;
    esac

    if [ "$paused" = false ]; then
        now=$(date +%s)
        elapsed=$((now - start_time - total_pause))
    fi

    hours=$((elapsed / 3600))
    minutes=$(((elapsed % 3600) / 60))
    seconds=$((elapsed % 60))

    time_string=$(printf "%02d:%02d:%02d" $hours $minutes $seconds)

    rows=$(tput lines 2>/dev/null)
    cols=$(tput cols 2>/dev/null)

    # Protección total para ventana mínima
    if [[ -z "$rows" || -z "$cols" || "$rows" -lt 1 || "$cols" -lt ${#time_string} ]]; then
        sleep 0.1
        continue
    fi

    row=$((rows / 2))
    col=$(((cols - ${#time_string}) / 2))
    ((col < 0)) && col=0

    clear
    tput cup $row $col
    printf "%s" "$time_string"

    sleep 0.1
done
