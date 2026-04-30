import * as React from 'react';
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components';
import { body, button, container, h1, text, textMuted } from '../_styles';

type Props = {
  name: string;
  verifyUrl: string;
  expiresInHours: number;
};

export default function EmailVerify({ name, verifyUrl, expiresInHours }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Verify your Middlemist email</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Verify your email</Heading>
          <Text style={text}>Hi {name},</Text>
          <Text style={text}>
            Click below to verify your email and activate your Middlemist account.
          </Text>
          <Link href={verifyUrl} style={button}>
            Verify email
          </Link>
          <Text style={textMuted}>
            This link expires in {expiresInHours} hours. If you didn&apos;t sign up, ignore this
            email.
          </Text>
          <Text style={textMuted}>— Middlemist</Text>
        </Container>
      </Body>
    </Html>
  );
}
