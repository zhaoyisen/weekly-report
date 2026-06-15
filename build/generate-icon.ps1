$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

function New-RoundedRect {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $Radius * 2
  $path.AddArc($X, $Y, $d, $d, 180, 90)
  $path.AddArc($X + $Width - $d, $Y, $d, $d, 270, 90)
  $path.AddArc($X + $Width - $d, $Y + $Height - $d, $d, $d, 0, 90)
  $path.AddArc($X, $Y + $Height - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-IconBitmap {
  param([int]$Size)

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $scale = $Size / 256.0
  function S([float]$value) { return $value * $scale }

  $bg = New-RoundedRect (S 12) (S 12) (S 232) (S 232) (S 42)
  $graphics.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#173b2d")), $bg)

  $paper = New-RoundedRect (S 48) (S 30) (S 160) (S 196) (S 22)
  $graphics.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#fff9ec")), $paper)

  $fold = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $fold.AddPolygon(@(
    [System.Drawing.PointF]::new((S 169), (S 30)),
    [System.Drawing.PointF]::new((S 208), (S 80)),
    [System.Drawing.PointF]::new((S 185), (S 80)),
    [System.Drawing.PointF]::new((S 169), (S 64))
  ))
  $graphics.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#d8b24a")), $fold)

  $linePen1 = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#28664a"), [Math]::Max(2, (S 10)))
  $linePen1.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen1.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($linePen1, (S 80), (S 96), (S 154), (S 96))
  $graphics.DrawLine($linePen1, (S 80), (S 123), (S 138), (S 123))
  $graphics.DrawLine($linePen1, (S 80), (S 150), (S 122), (S 150))

  $checkPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#d8b24a"), [Math]::Max(3, (S 16)))
  $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $graphics.DrawLines($checkPen, @(
    [System.Drawing.PointF]::new((S 134), (S 173)),
    [System.Drawing.PointF]::new((S 159), (S 197)),
    [System.Drawing.PointF]::new((S 207), (S 132))
  ))

  $sparkPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#fff9ec"), [Math]::Max(2, (S 8)))
  $sparkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $sparkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($sparkPen, (S 200), (S 45), (S 200), (S 69))
  $graphics.DrawLine($sparkPen, (S 188), (S 57), (S 212), (S 57))
  $graphics.FillEllipse([System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#4f9ecf")), (S 208), (S 89), (S 12), (S 12))

  $graphics.Dispose()
  return $bitmap
}

function Get-PngBytes {
  param([int]$Size)
  $bitmap = New-IconBitmap $Size
  $stream = [System.IO.MemoryStream]::new()
  try {
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return ,$stream.ToArray()
  } finally {
    $bitmap.Dispose()
    $stream.Dispose()
  }
}

function Write-Ico {
  param(
    [string]$Path,
    [int[]]$Sizes
  )

  $images = @()
  foreach ($size in $Sizes) {
      $images += [pscustomobject]@{
        Size = $size
        Bytes = [byte[]](Get-PngBytes $size)
      }
  }

  $stream = [System.IO.File]::Create($Path)
  $writer = [System.IO.BinaryWriter]::new($stream)
  try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$images.Count)

    $offset = 6 + (16 * $images.Count)
    foreach ($image in $images) {
      $writer.Write([Byte]($(if ($image.Size -eq 256) { 0 } else { $image.Size })))
      $writer.Write([Byte]($(if ($image.Size -eq 256) { 0 } else { $image.Size })))
      $writer.Write([Byte]0)
      $writer.Write([Byte]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]32)
      $writer.Write([UInt32]$image.Bytes.Length)
      $writer.Write([UInt32]$offset)
      $offset += $image.Bytes.Length
    }

    foreach ($image in $images) {
      $writer.Write([byte[]]$image.Bytes)
    }
  } finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

$buildDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pngPath = Join-Path $buildDir "icon.png"
$icoPath = Join-Path $buildDir "icon.ico"

$png = New-IconBitmap 512
try {
  $png.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $png.Dispose()
}

Write-Ico -Path $icoPath -Sizes @(16, 24, 32, 48, 64, 128, 256)
Write-Host "Generated $pngPath and $icoPath"
