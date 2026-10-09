import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(16);
// Standard delivery colour: limited-range yuv420p tagged bt709 (otherwise JPEG frames give full-range
// yuvj420p / bt470bg, which some players show washed out).
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
