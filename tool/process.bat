@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "INPUT_FILE=input.txt"
set "OUTPUT_FILE=output.txt"
set "TEMP_FILE=temp_chars.txt"

if not exist "%INPUT_FILE%" (
    echo [LỖI] Không tìm thấy file %INPUT_FILE%
    pause
    exit /b
)

echo [1/4] Đang khởi tạo file tạm...
type nul > "%TEMP_FILE%"
type nul > "%OUTPUT_FILE%"

echo [2/4] Đang đọc file và tách từng ký tự...
set /a line_count=0
for /f "usebackq delims=" %%A in ("%INPUT_FILE%") do (
    set "line=%%A"
    set "line=!line:﻿=!"
    if defined line (
        if not "!line!"=="==============" (
            set /a line_count+=1
            echo   - Đang xử lý dòng !line_count!: !line!
            
            set "str=!line!"
            set "loop=1"
            for /L %%I in (1,1,100) do (
                if "!loop!"=="1" (
                    if defined str (
                        set "char=!str:~0,1!"
                        if not "!char!"==" " (
                            if defined char (
                                echo !char!>> "%TEMP_FILE%"
                            )
                        )
                        set "str=!str:~1!"
                    ) else (
                        set "loop=0"
                    )
                )
            )
        )
    )
)

if not exist "%TEMP_FILE%" (
    echo [LỖI] Không thể trích xuất ký tự từ file đầu vào!
    pause
    exit /b
)

echo [3/4] Đang lọc bỏ các chữ trùng lặp...
for /f "usebackq delims=" %%A in ("%TEMP_FILE%") do (
    set "char=%%A"
    if defined char (
        set "defined_!char!=1"
    )
)

echo [4/4] Đang gộp chữ Hán duy nhất vào một dòng...
set "out_line="
for /f "tokens=2 delims=_=" %%A in ('set defined_ 2^>nul') do (
    set "out_line=!out_line!%%A"
)

if defined out_line (
    echo !out_line!> "%OUTPUT_FILE%"
) else (
    echo [DỰ PHÒNG] Đang dùng phương thức quét Findstr trực tiếp...
    set "out_line="
    for /f "usebackq delims=" %%A in ("%TEMP_FILE%") do (
        set "char=%%A"
        if defined char (
            echo !out_line! | findstr /C:"!char!" >nul
            if errorlevel 1 (
                set "out_line=!out_line!!char!"
            )
        )
    )
    echo !out_line!> "%OUTPUT_FILE%"
)

if exist "%TEMP_FILE%" del "%TEMP_FILE%"

echo ==================================================
echo [THÀNH CÔNG] Đã trích xuất các chữ Hán duy nhất vào file %OUTPUT_FILE%
echo Kết quả trên 1 dòng: !out_line!
echo ==================================================
pause
exit /b